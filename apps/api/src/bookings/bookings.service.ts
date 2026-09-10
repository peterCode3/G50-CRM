import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GlobalRole, LocationRole, Prisma } from '@g50golf/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreditsService } from '../credits/credits.service.js';
import type { AuthenticatedUser } from '../auth/types.js';
import type { CancelBookingDto } from './dto/cancel-booking.dto.js';
import type { CreateBookingDto } from './dto/create-booking.dto.js';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditsService: CreditsService,
  ) {}

  /**
   * Capacity-safe booking creation — same SERIALIZABLE-transaction pattern as
   * SessionsService's coach double-booking check (Phase 3), applied here to
   * counting CONFIRMED bookings against Session.capacity instead of coach
   * time overlap. Concurrent requests for the last spot can't both succeed:
   * Postgres aborts one with a serialization failure (P2034), surfaced as the
   * same 409 a plain capacity check would give.
   *
   * Pricing (Phase 5): `paymentMethod` picks how the booking is paid for.
   * MEMBERSHIP and CREDIT are checked *inside* the same transaction as the
   * capacity check — an active membership or an eligible credit balance is
   * as much a scarce, racy resource as the seat itself.
   */
  async create(sessionId: string, dto: CreateBookingDto, user: AuthenticatedUser) {
    const session = await this.prisma.client.session.findUnique({
      where: { id: sessionId },
      include: { service: true },
    });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    if (session.isCancelled) {
      throw new BadRequestException('This session has been cancelled');
    }
    if (session.startTime <= new Date()) {
      throw new BadRequestException('This session has already started');
    }

    const existing = await this.prisma.client.booking.findFirst({
      where: { sessionId, userId: user.id, status: 'CONFIRMED' },
    });
    if (existing) {
      throw new ConflictException('You already have a booking for this session');
    }

    const paymentMethod = dto.paymentMethod ?? 'FULL_PRICE';

    try {
      return await this.prisma.client.$transaction(
        async (tx) => {
          if (session.capacity != null) {
            const confirmedCount = await tx.booking.count({
              where: { sessionId, status: 'CONFIRMED' },
            });
            if (confirmedCount >= session.capacity) {
              throw new ConflictException(
                'This session is full — join the waitlist instead',
              );
            }
          }

          let priceCharged: Prisma.Decimal | number = session.service.price;
          let userMembershipId: string | undefined;
          let creditBalanceId: string | undefined;

          if (paymentMethod === 'MEMBERSHIP') {
            const membership = await tx.userMembership.findFirst({
              where: {
                userId: user.id,
                status: 'ACTIVE',
                OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
              },
              include: { plan: true },
            });
            if (!membership) {
              throw new BadRequestException('You do not have an active membership');
            }
            if (
              !membership.plan.crossLocationAccess &&
              membership.plan.locationId &&
              membership.plan.locationId !== session.locationId
            ) {
              throw new BadRequestException('Your membership does not cover this location');
            }
            priceCharged = session.service.memberPrice ?? session.service.price;
            userMembershipId = membership.id;
          } else if (paymentMethod === 'CREDIT') {
            const balance = await this.creditsService.findEligibleBalance(
              tx,
              user.id,
              session.service.type,
            );
            if (!balance) {
              throw new BadRequestException('No eligible credits available for this service');
            }
            priceCharged = 0;
            creditBalanceId = balance.id;
          }

          const booking = await tx.booking.create({
            data: {
              sessionId,
              userId: user.id,
              locationId: session.locationId,
              status: 'CONFIRMED',
              priceCharged,
              userMembershipId,
            },
          });

          if (creditBalanceId) {
            await this.creditsService.redeemOne(tx, creditBalanceId, booking.id);
          }

          return booking;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      if (err instanceof ConflictException || err instanceof BadRequestException) {
        throw err;
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
        throw new ConflictException(
          'This session just filled up — join the waitlist instead',
        );
      }
      throw err;
    }
  }

  findMine(user: AuthenticatedUser) {
    return this.prisma.client.booking.findMany({
      where: { userId: user.id },
      include: { session: { include: { service: true, location: true } } },
      orderBy: { session: { startTime: 'desc' } },
    });
  }

  async cancel(id: string, dto: CancelBookingDto, user: AuthenticatedUser) {
    const booking = await this.prisma.client.booking.findUnique({
      where: { id },
      include: { session: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    this.assertCanManageBooking(booking, user);

    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException('Only a confirmed booking can be cancelled');
    }
    if (booking.session.startTime <= new Date()) {
      throw new BadRequestException('Cannot cancel a session that has already started');
    }

    return this.prisma.client.$transaction(async (tx) => {
      const cancelled = await tx.booking.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: dto.reason },
      });

      // Return the credit if this booking was paid for by redeeming one.
      // (Simplification, noted in the roadmap: every cancellation reaching
      // this point is already "before the session starts" — there's no
      // separate late-cancellation-forfeit window modeled yet.)
      const debit = await tx.creditTransaction.findFirst({
        where: { bookingId: id, amount: { lt: 0 } },
      });
      if (debit) {
        await this.creditsService.refundOne(tx, debit.creditBalanceId, id);
      }

      // A confirmed spot just freed up — notify the next person in the
      // waitlist queue (spec §10: notify+claim, not fully automatic promotion
      // for V1).
      const nextInLine = await tx.waitlistEntry.findFirst({
        where: { sessionId: booking.sessionId, status: 'WAITING' },
        orderBy: { position: 'asc' },
      });
      if (nextInLine) {
        await tx.waitlistEntry.update({
          where: { id: nextInLine.id },
          data: { status: 'NOTIFIED', notifiedAt: new Date() },
        });
      }

      return cancelled;
    });
  }

  private assertCanManageBooking(
    booking: { userId: string; locationId: string },
    user: AuthenticatedUser,
  ): void {
    if (booking.userId === user.id) {
      return;
    }
    if (user.globalRole === GlobalRole.HQ_ADMIN) {
      return;
    }
    const manages = user.locations.some(
      (l) => l.locationId === booking.locationId && l.role === LocationRole.LOCATION_ADMIN,
    );
    if (!manages) {
      throw new ForbiddenException('You cannot manage this booking');
    }
  }
}
