import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ServiceType } from '@g50golf/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { AuthenticatedUser } from '../auth/types.js';
import type { CreateCreditPackageDto } from './dto/create-credit-package.dto.js';
import type { UpdateCreditPackageDto } from './dto/update-credit-package.dto.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class CreditsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  create(dto: CreateCreditPackageDto) {
    return this.prisma.client.creditPackage.create({ data: dto });
  }

  findActive(locationId?: string) {
    return this.prisma.client.creditPackage.findMany({
      where: {
        isActive: true,
        ...(locationId ? { OR: [{ locationId }, { locationId: null }] } : {}),
      },
      orderBy: { price: 'asc' },
    });
  }

  findAll() {
    return this.prisma.client.creditPackage.findMany({ orderBy: { price: 'asc' } });
  }

  async findOne(id: string) {
    const pkg = await this.prisma.client.creditPackage.findUnique({ where: { id } });
    if (!pkg) {
      throw new NotFoundException('Credit package not found');
    }
    return pkg;
  }

  async update(id: string, dto: UpdateCreditPackageDto) {
    await this.findOne(id);
    return this.prisma.client.creditPackage.update({ where: { id }, data: dto });
  }

  async purchase(packageId: string, user: AuthenticatedUser) {
    const pkg = await this.findOne(packageId);
    if (!pkg.isActive) {
      throw new BadRequestException('This credit package is no longer available');
    }

    const balance = await this.prisma.client.creditBalance.create({
      data: {
        userId: user.id,
        packageId: pkg.id,
        creditsRemaining: pkg.creditsIncluded,
        expiresAt: pkg.expiryDays ? new Date(Date.now() + pkg.expiryDays * 24 * 60 * 60_000) : null,
      },
    });

    void this.notifications.packageConfirmed(user, pkg.name, pkg.creditsIncluded);
    return balance;
  }

  findMyBalances(user: AuthenticatedUser) {
    return this.prisma.client.creditBalance.findMany({
      where: { userId: user.id },
      include: { package: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Finds the soonest-expiring credit balance the user can redeem for a given
   * service type. Runs inside the caller's transaction (BookingsService) so
   * the eligibility check and the later decrement are part of the same
   * atomic operation as the capacity check.
   */
  findEligibleBalance(tx: Tx, userId: string, serviceType: ServiceType) {
    return tx.creditBalance.findFirst({
      where: {
        userId,
        creditsRemaining: { gt: 0 },
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          {
            OR: [
              { packageId: null },
              { package: { eligibleServiceType: null } },
              { package: { eligibleServiceType: serviceType } },
            ],
          },
        ],
      },
      include: { package: true },
      orderBy: { expiresAt: 'asc' },
    });
  }

  /** Debits one credit and records the transaction — call inside a transaction. */
  async redeemOne(tx: Tx, creditBalanceId: string, bookingId: string) {
    await tx.creditBalance.update({
      where: { id: creditBalanceId },
      data: { creditsRemaining: { decrement: 1 } },
    });
    await tx.creditTransaction.create({
      data: { creditBalanceId, bookingId, amount: -1, reason: 'Booking redemption' },
    });
  }

  /** Reverses a redemption on eligible cancellation — call inside a transaction. */
  async refundOne(tx: Tx, creditBalanceId: string, bookingId: string) {
    await tx.creditBalance.update({
      where: { id: creditBalanceId },
      data: { creditsRemaining: { increment: 1 } },
    });
    await tx.creditTransaction.create({
      data: { creditBalanceId, bookingId, amount: 1, reason: 'Cancellation refund' },
    });
  }

  /**
   * Manual credit grant/deduction by an admin (spec §8) — outside any
   * purchase/booking flow, e.g. a goodwill credit or correcting an error.
   * A grant (delta > 0) creates its own standalone balance (no package, no
   * expiry) so it's clearly attributable to this adjustment. A deduction
   * (delta < 0) draws down existing balances, soonest-expiring first — the
   * same priority order a booking redemption already uses — and is rejected
   * outright if the customer doesn't have enough total credit to cover it.
   */
  async adjustBalance(userId: string, delta: number, reason: string, adminUserId: string) {
    if (delta === 0) {
      throw new BadRequestException('Adjustment amount cannot be zero');
    }

    return this.prisma.client.$transaction(async (tx) => {
      if (delta > 0) {
        const balance = await tx.creditBalance.create({
          data: { userId, packageId: null, creditsRemaining: delta, expiresAt: null },
        });
        await tx.creditTransaction.create({
          data: {
            creditBalanceId: balance.id,
            amount: delta,
            reason: `Admin adjustment: ${reason}`,
          },
        });
        return balance;
      }

      let remaining = -delta;
      const balances = await tx.creditBalance.findMany({
        where: { userId, creditsRemaining: { gt: 0 } },
        orderBy: { expiresAt: { sort: 'asc', nulls: 'last' } },
      });
      const totalAvailable = balances.reduce((sum, b) => sum + b.creditsRemaining, 0);
      if (totalAvailable < remaining) {
        throw new BadRequestException(
          `This customer only has ${totalAvailable} credit(s) available to deduct`,
        );
      }

      for (const balance of balances) {
        if (remaining <= 0) break;
        const take = Math.min(balance.creditsRemaining, remaining);
        await tx.creditBalance.update({
          where: { id: balance.id },
          data: { creditsRemaining: { decrement: take } },
        });
        await tx.creditTransaction.create({
          data: {
            creditBalanceId: balance.id,
            amount: -take,
            reason: `Admin adjustment: ${reason}`,
          },
        });
        remaining -= take;
      }

      return { userId, adjustedBy: adminUserId, delta };
    });
  }
}
