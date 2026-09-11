import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type Stripe from 'stripe';
import { GlobalRole, PaymentStatus } from '@g50golf/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertManagesLocation } from '../auth/location-access.util.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { BookingsService } from '../bookings/bookings.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { StripeClientService } from './stripe-client.service.js';

const CURRENCY = 'aud';

function toCents(amount: unknown): number {
  return Math.round(Number(amount) * 100);
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeClientService,
    private readonly bookingsService: BookingsService,
    private readonly notifications: NotificationsService,
  ) {}

  async createIntentForBooking(bookingId: string, user: AuthenticatedUser) {
    const booking = await this.prisma.client.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== user.id) throw new ForbiddenException('Not your booking');
    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException('Only a confirmed booking can be paid for');
    }
    if (!booking.priceCharged || Number(booking.priceCharged) <= 0) {
      throw new BadRequestException('This booking does not require payment');
    }

    const existing = await this.prisma.client.payment.findFirst({
      where: { bookingId, status: { in: ['PENDING', 'PAID'] } },
    });
    if (existing) {
      return this.reuseOrRejectExisting(existing);
    }

    const intent = await this.stripe.client.paymentIntents.create({
      amount: toCents(booking.priceCharged),
      currency: CURRENCY,
      metadata: { purpose: 'BOOKING', bookingId },
    });

    const payment = await this.prisma.client.payment.create({
      data: {
        userId: user.id,
        bookingId,
        amount: booking.priceCharged,
        purpose: 'BOOKING',
        provider: 'stripe',
        providerRef: intent.id,
        status: 'PENDING',
      },
    });

    return { paymentId: payment.id, clientSecret: intent.client_secret };
  }

  async createIntentForMembership(userMembershipId: string, user: AuthenticatedUser) {
    const membership = await this.prisma.client.userMembership.findUnique({
      where: { id: userMembershipId },
      include: { plan: true },
    });
    if (!membership) throw new NotFoundException('Membership not found');
    if (membership.userId !== user.id) throw new ForbiddenException('Not your membership');
    if (Number(membership.plan.price) <= 0) {
      throw new BadRequestException('This plan does not require payment');
    }

    const existing = await this.prisma.client.payment.findFirst({
      where: { userMembershipId, status: { in: ['PENDING', 'PAID'] } },
    });
    if (existing) {
      return this.reuseOrRejectExisting(existing);
    }

    const intent = await this.stripe.client.paymentIntents.create({
      amount: toCents(membership.plan.price),
      currency: CURRENCY,
      metadata: { purpose: 'MEMBERSHIP', userMembershipId },
    });

    const payment = await this.prisma.client.payment.create({
      data: {
        userId: user.id,
        userMembershipId,
        amount: membership.plan.price,
        purpose: 'MEMBERSHIP',
        provider: 'stripe',
        providerRef: intent.id,
        status: 'PENDING',
      },
    });

    return { paymentId: payment.id, clientSecret: intent.client_secret };
  }

  async createIntentForCreditBalance(creditBalanceId: string, user: AuthenticatedUser) {
    const balance = await this.prisma.client.creditBalance.findUnique({
      where: { id: creditBalanceId },
      include: { package: true },
    });
    if (!balance) throw new NotFoundException('Credit balance not found');
    if (balance.userId !== user.id) throw new ForbiddenException('Not your credit balance');
    if (!balance.package || Number(balance.package.price) <= 0) {
      throw new BadRequestException('This package does not require payment');
    }

    const existing = await this.prisma.client.payment.findFirst({
      where: { creditBalanceId, status: { in: ['PENDING', 'PAID'] } },
    });
    if (existing) {
      return this.reuseOrRejectExisting(existing);
    }

    const intent = await this.stripe.client.paymentIntents.create({
      amount: toCents(balance.package.price),
      currency: CURRENCY,
      metadata: { purpose: 'PACKAGE', creditBalanceId },
    });

    const payment = await this.prisma.client.payment.create({
      data: {
        userId: user.id,
        creditBalanceId,
        amount: balance.package.price,
        purpose: 'PACKAGE',
        provider: 'stripe',
        providerRef: intent.id,
        status: 'PENDING',
      },
    });

    return { paymentId: payment.id, clientSecret: intent.client_secret };
  }

  private async reuseOrRejectExisting(existing: { id: string; status: PaymentStatus; providerRef: string | null }) {
    if (existing.status === 'PAID') {
      throw new ConflictException('This has already been paid for');
    }
    const intent = await this.stripe.client.paymentIntents.retrieve(existing.providerRef!);
    return { paymentId: existing.id, clientSecret: intent.client_secret };
  }

  findMine(user: AuthenticatedUser) {
    return this.prisma.client.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Stripe webhook — the only place Payment.status moves to PAID/FAILED.
   * Signature-verified (raw body), so this is a trusted system caller with no
   * per-user auth context; a failed BOOKING payment releases the seat through
   * the same path a golfer's own cancellation would use.
   */
  async handleWebhookEvent(rawBody: Buffer, signature: string) {
    let event: Stripe.Event;
    try {
      event = this.stripe.client.webhooks.constructEvent(rawBody, signature, this.stripe.webhookSecret);
    } catch {
      // An invalid/forged signature is a client error (a malformed or spoofed
      // request), not a server fault — surface 400, not an unhandled 500.
      throw new BadRequestException('Invalid webhook signature');
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const payment = await this.setStatus(intent.id, 'PAID');
      if (payment) {
        const user = await this.prisma.client.user.findUnique({ where: { id: payment.userId } });
        if (user) {
          void this.notifications.paymentConfirmed(user, payment.amount.toFixed(2));
        }
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const payment = await this.setStatus(intent.id, 'FAILED');
      await this.releaseOnFailure(payment);
    }

    return { received: true };
  }

  private async setStatus(providerRef: string, status: PaymentStatus) {
    const payment = await this.prisma.client.payment.findFirst({ where: { providerRef } });
    if (!payment) return null;
    return this.prisma.client.payment.update({ where: { id: payment.id }, data: { status } });
  }

  /**
   * Undoes what was optimistically granted at booking/subscribe/purchase time
   * once a payment is confirmed to have actually failed. A booking's seat is
   * released through BookingsService's own cancellation path (capacity +
   * waitlist notify) rather than a bare status flip, so this stays consistent
   * with every other way a booking gets cancelled.
   */
  private async releaseOnFailure(
    payment: { purpose: string; bookingId: string | null; userMembershipId: string | null; creditBalanceId: string | null } | null,
  ) {
    if (!payment) return;
    if (payment.purpose === 'BOOKING' && payment.bookingId) {
      await this.bookingsService.releaseForFailedPayment(payment.bookingId);
    } else if (payment.purpose === 'MEMBERSHIP' && payment.userMembershipId) {
      await this.prisma.client.userMembership.update({
        where: { id: payment.userMembershipId },
        data: { status: 'CANCELLED' },
      });
    } else if (payment.purpose === 'PACKAGE' && payment.creditBalanceId) {
      await this.prisma.client.creditBalance.update({
        where: { id: payment.creditBalanceId },
        data: { creditsRemaining: 0 },
      });
    }
  }

  async refund(paymentId: string, user: AuthenticatedUser) {
    const payment = await this.prisma.client.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'PAID') {
      throw new BadRequestException('Only a paid payment can be refunded');
    }

    if (payment.booking) {
      assertManagesLocation(user, payment.booking.locationId);
    } else if (user.globalRole !== GlobalRole.HQ_ADMIN) {
      throw new ForbiddenException('Only HQ can refund a non-booking payment');
    }

    await this.stripe.client.refunds.create({ payment_intent: payment.providerRef! });
    return this.prisma.client.payment.update({ where: { id: paymentId }, data: { status: 'REFUNDED' } });
  }
}
