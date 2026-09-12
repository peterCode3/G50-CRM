import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingPeriod } from '@g50golf/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { AuthenticatedUser } from '../auth/types.js';
import type { CreateMembershipPlanDto } from './dto/create-membership-plan.dto.js';
import type { UpdateMembershipPlanDto } from './dto/update-membership-plan.dto.js';

export const BILLING_PERIOD_MS: Record<BillingPeriod, number | null> = {
  NONE: null,
  WEEKLY: 7 * 24 * 60 * 60_000,
  MONTHLY: 30 * 24 * 60 * 60_000,
  QUARTERLY: 90 * 24 * 60 * 60_000,
  ANNUAL: 365 * 24 * 60 * 60_000,
};

@Injectable()
export class MembershipPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  create(dto: CreateMembershipPlanDto) {
    return this.prisma.client.membershipPlan.create({ data: dto });
  }

  findActive(locationId?: string) {
    return this.prisma.client.membershipPlan.findMany({
      where: {
        isActive: true,
        ...(locationId ? { OR: [{ locationId }, { locationId: null }] } : {}),
      },
      orderBy: { price: 'asc' },
    });
  }

  findAll() {
    return this.prisma.client.membershipPlan.findMany({ orderBy: { price: 'asc' } });
  }

  async findOne(id: string) {
    const plan = await this.prisma.client.membershipPlan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Membership plan not found');
    }
    return plan;
  }

  async update(id: string, dto: UpdateMembershipPlanDto) {
    await this.findOne(id);
    return this.prisma.client.membershipPlan.update({ where: { id }, data: dto });
  }

  async subscribe(planId: string, user: AuthenticatedUser, autoRenew = false) {
    const plan = await this.findOne(planId);
    if (!plan.isActive) {
      throw new BadRequestException('This membership plan is no longer available');
    }

    const existing = await this.prisma.client.userMembership.findFirst({
      where: { userId: user.id, planId, status: 'ACTIVE' },
    });
    if (existing) {
      throw new ConflictException('You already have an active membership on this plan');
    }

    const periodMs = BILLING_PERIOD_MS[plan.billingPeriod];
    const startDate = new Date();
    const endDate = periodMs != null ? new Date(startDate.getTime() + periodMs) : null;

    const membership = await this.prisma.client.userMembership.create({
      // Auto-renew only makes sense for a plan that actually recurs — a
      // one-off (NONE) billing period has nothing to renew into.
      data: {
        userId: user.id,
        planId,
        startDate,
        endDate,
        status: 'ACTIVE',
        autoRenew: autoRenew && periodMs != null,
      },
    });

    if (plan.includedCredits) {
      await this.prisma.client.creditBalance.create({
        data: {
          userId: user.id,
          creditsRemaining: plan.includedCredits,
          expiresAt: endDate,
        },
      });
    }

    void this.notifications.membershipConfirmed(user, plan.name);
    return membership;
  }

  findMine(user: AuthenticatedUser) {
    return this.prisma.client.userMembership.findMany({
      where: { userId: user.id },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
