import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, GlobalRole, LocationRole, Prisma } from '@g50golf/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreditsService } from '../credits/credits.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { assertCanManageSession, resolveLocationScope } from '../auth/location-access.util.js';
import type { AuthenticatedUser } from '../auth/types.js';
import type { CancelBookingDto } from './dto/cancel-booking.dto.js';
import type { CreateBookingDto } from './dto/create-booking.dto.js';

// A class is capacity-managed and self-service; an appointment is 1:1 with a
// specific coach, so it needs their sign-off before it's really "on" — spec
// discussion with the user: coach should be able to accept/decline a request.
const REQUIRES_COACH_APPROVAL: readonly string[] = ['APPOINTMENT'];
// Both of these hold a seat — a PENDING request blocks the slot exactly like
// a CONFIRMED one so nobody else can grab it while the coach is deciding.
const SEAT_HOLDING_STATUSES: BookingStatus[] = ['CONFIRMED', 'PENDING'];

export interface BookingAdminFilters {
  locationId?: string;
  status?: string;
  from?: string;
  to?: string;
  search?: string;
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditsService: CreditsService,
    private readonly notifications: NotificationsService,
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
      include: { service: true, coach: true },
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
      where: { sessionId, userId: user.id, status: { in: SEAT_HOLDING_STATUSES } },
    });
    if (existing) {
      throw new ConflictException('You already have a booking for this session');
    }

    const paymentMethod = dto.paymentMethod ?? 'FULL_PRICE';
    const needsCoachApproval = REQUIRES_COACH_APPROVAL.includes(session.service.type);
    const initialStatus: BookingStatus = needsCoachApproval ? 'PENDING' : 'CONFIRMED';

    let booking;
    try {
      booking = await this.prisma.client.$transaction(
        async (tx) => {
          if (session.capacity != null) {
            const heldCount = await tx.booking.count({
              where: { sessionId, status: { in: SEAT_HOLDING_STATUSES } },
            });
            if (heldCount >= session.capacity) {
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
              status: initialStatus,
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

    if (needsCoachApproval) {
      void this.notifications.appointmentRequested(user, session.service.name, session.startTime);
      if (session.coach) {
        void this.notifications.newAppointmentRequestForCoach(
          session.coach,
          session.service.name,
          session.startTime,
          `${user.firstName} ${user.lastName}`,
        );
      }
    } else {
      void this.notifications.bookingConfirmed(user, session.service.name, session.startTime);
    }
    return booking;
  }

  findMine(user: AuthenticatedUser) {
    return this.prisma.client.booking.findMany({
      where: { userId: user.id },
      include: { session: { include: { service: true, location: true } } },
      orderBy: { session: { startTime: 'desc' } },
    });
  }

  /**
   * Network-wide (HQ) or location-scoped (Location Admin) booking list —
   * the admin "Bookings" page. Same location-scoping convention as Reports.
   */
  async findAllForAdmin(filters: BookingAdminFilters, user: AuthenticatedUser) {
    const locationIds = resolveLocationScope(user, filters.locationId);
    if (locationIds !== null && locationIds.length === 0) {
      return [];
    }

    const search = filters.search?.trim();

    return this.prisma.client.booking.findMany({
      where: {
        ...(locationIds ? { locationId: { in: locationIds } } : {}),
        ...(filters.status ? { status: filters.status as BookingStatus } : {}),
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
        ...(search
          ? {
              user: {
                OR: [
                  { firstName: { contains: search, mode: 'insensitive' } },
                  { lastName: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        location: { select: { id: true, name: true } },
        session: { include: { service: { select: { id: true, name: true, type: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
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

    // A still-pending appointment request can also be withdrawn by the
    // golfer who made it — same release path as a confirmed cancellation.
    if (booking.status !== 'CONFIRMED' && booking.status !== 'PENDING') {
      throw new BadRequestException('Only a confirmed or pending booking can be cancelled');
    }
    if (booking.session.startTime <= new Date()) {
      throw new BadRequestException('Cannot cancel a session that has already started');
    }

    return this.releaseBooking(id, dto.reason);
  }

  /**
   * Pending appointment requests this user can act on: their own coached
   * sessions, plus (for HQ/Location Admin) anything at a location they
   * manage — the admin "Booking requests" view.
   */
  async findPendingForUser(user: AuthenticatedUser) {
    // HQ sees every pending request network-wide — no session filter at all.
    // (An empty object as one of several `OR` branches does NOT mean "match
    // everything" in Prisma; it matches nothing, so HQ's case is handled by
    // omitting the filter rather than by adding a vacuous OR branch.)
    let sessionFilter: Prisma.SessionWhereInput | undefined;
    if (user.globalRole !== GlobalRole.HQ_ADMIN) {
      const sessionConditions: Prisma.SessionWhereInput[] = [{ coachId: user.id }];
      const managedLocationIds = user.locations
        .filter((l) => l.role === LocationRole.LOCATION_ADMIN)
        .map((l) => l.locationId);
      if (managedLocationIds.length > 0) {
        sessionConditions.push({ locationId: { in: managedLocationIds } });
      }
      sessionFilter = { OR: sessionConditions };
    }

    return this.prisma.client.booking.findMany({
      where: { status: 'PENDING', ...(sessionFilter ? { session: sessionFilter } : {}) },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        location: { select: { id: true, name: true } },
        session: { include: { service: { select: { id: true, name: true, type: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * A coach (or the location's admin) accepting a pending appointment
   * request — flips PENDING -> CONFIRMED and lets the golfer know.
   */
  async accept(id: string, user: AuthenticatedUser) {
    const booking = await this.prisma.client.booking.findUnique({
      where: { id },
      include: { user: true, session: { include: { service: true } } },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    assertCanManageSession(user, booking.session);
    if (booking.status !== 'PENDING') {
      throw new BadRequestException('Only a pending request can be accepted');
    }

    const confirmed = await this.prisma.client.booking.update({
      where: { id },
      data: { status: 'CONFIRMED' },
    });
    void this.notifications.bookingConfirmed(
      booking.user,
      booking.session.service.name,
      booking.session.startTime,
    );
    return confirmed;
  }

  /**
   * A coach (or the location's admin) declining a pending appointment
   * request — releases the seat (and any spent credit/membership) exactly
   * like a cancellation, but tells the golfer it was declined rather than
   * cancelled.
   */
  async decline(id: string, dto: CancelBookingDto, user: AuthenticatedUser) {
    const booking = await this.prisma.client.booking.findUnique({
      where: { id },
      include: { session: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    assertCanManageSession(user, booking.session);
    if (booking.status !== 'PENDING') {
      throw new BadRequestException('Only a pending request can be declined');
    }

    return this.releaseBooking(id, dto.reason ?? 'Declined by coach', true);
  }

  /**
   * Releases a booking whose payment turned out to have actually failed
   * (Stripe webhook, Phase 6) — same seat-release/credit-refund/waitlist-notify
   * effects as a normal cancellation, but reached without a user in the
   * request (the webhook is a trusted, signature-verified system caller) and
   * without the "session already started" guard, since a payment usually
   * fails within seconds of booking, not after the session has run.
   * Idempotent: a booking that isn't CONFIRMED any more (e.g. already
   * cancelled) is left alone.
   */
  async releaseForFailedPayment(id: string) {
    const booking = await this.prisma.client.booking.findUnique({ where: { id } });
    if (!booking || booking.status !== 'CONFIRMED') {
      return booking;
    }
    return this.releaseBooking(id, 'Payment failed');
  }

  private async releaseBooking(id: string, reason?: string, declined = false) {
    const { cancelled, booking, nextInLine } = await this.prisma.client.$transaction(async (tx) => {
      const booking = await tx.booking.findUniqueOrThrow({
        where: { id },
        include: { user: true, session: { include: { service: true } } },
      });
      const cancelled = await tx.booking.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason },
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
        include: { user: true },
      });
      if (nextInLine) {
        await tx.waitlistEntry.update({
          where: { id: nextInLine.id },
          data: { status: 'NOTIFIED', notifiedAt: new Date() },
        });
      }

      return { cancelled, booking, nextInLine };
    });

    if (declined) {
      void this.notifications.bookingDeclined(
        booking.user,
        booking.session.service.name,
        booking.session.startTime,
      );
    } else {
      void this.notifications.bookingCancelled(
        booking.user,
        booking.session.service.name,
        booking.session.startTime,
      );
    }
    if (nextInLine) {
      void this.notifications.waitlistAvailable(
        nextInLine.user,
        booking.session.service.name,
        booking.session.startTime,
      );
    }

    return cancelled;
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
