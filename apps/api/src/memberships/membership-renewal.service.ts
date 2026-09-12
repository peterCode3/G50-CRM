import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { BILLING_PERIOD_MS } from './membership-plans.service.js';

/**
 * Daily sweep for spec §7's "auto-renewal" and "membership status" —
 * previously `autoRenew`/`status` were static flags nothing ever acted on.
 * A membership past its `endDate` either renews for one more billing period
 * (if `autoRenew` was set at subscribe time) or is flipped to EXPIRED, in
 * both cases with a notification. Membership expiry isn't minute-sensitive,
 * so once a day is plenty (unlike the hourly booking-reminder cron).
 */
@Injectable()
export class MembershipRenewalService {
  private readonly logger = new Logger(MembershipRenewalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async processExpiredMemberships() {
    const now = new Date();
    const dueMemberships = await this.prisma.client.userMembership.findMany({
      where: { status: 'ACTIVE', endDate: { lte: now } },
      include: { user: true, plan: true },
    });

    let renewed = 0;
    let expired = 0;

    for (const membership of dueMemberships) {
      const periodMs = BILLING_PERIOD_MS[membership.plan.billingPeriod];

      if (membership.autoRenew && periodMs != null) {
        const newEndDate = new Date(now.getTime() + periodMs);
        await this.prisma.client.userMembership.update({
          where: { id: membership.id },
          data: { startDate: now, endDate: newEndDate },
        });
        if (membership.plan.includedCredits) {
          await this.prisma.client.creditBalance.create({
            data: {
              userId: membership.userId,
              creditsRemaining: membership.plan.includedCredits,
              expiresAt: newEndDate,
            },
          });
        }
        void this.notifications.membershipRenewed(membership.user, membership.plan.name);
        renewed += 1;
      } else {
        await this.prisma.client.userMembership.update({
          where: { id: membership.id },
          data: { status: 'EXPIRED' },
        });
        void this.notifications.membershipExpired(membership.user, membership.plan.name);
        expired += 1;
      }
    }

    if (renewed > 0 || expired > 0) {
      this.logger.log(`Membership sweep: ${renewed} renewed, ${expired} expired`);
    }
  }
}
