import { Injectable } from '@nestjs/common';
import { GlobalRole, LocationRole, Prisma } from '@g50golf/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertManagesLocation } from '../auth/location-access.util.js';
import type { AuthenticatedUser } from '../auth/types.js';

export interface ReportFilters {
  locationId?: string;
  from?: string;
  to?: string;
  serviceId?: string;
  coachId?: string;
}

const BOOKING_STATUSES = ['CONFIRMED', 'CANCELLED', 'WAITLISTED', 'COMPLETED', 'NO_SHOW'] as const;
const ATTENDANCE_STATUSES = ['ATTENDED', 'ABSENT', 'LATE_CANCEL', 'NO_SHOW'] as const;
// Bookings that were actually paid and kept the money — a cancelled booking's
// priceCharged is never counted as revenue (nothing was collected for it in
// the end; see BookingsService.cancel, which never touches priceCharged but
// also never involves Stripe yet — Phase 6).
const REVENUE_STATUSES = ['CONFIRMED', 'COMPLETED', 'NO_SHOW'] as const;

function emptyOverview(from: Date, to: Date) {
  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    bookings: { total: 0, byStatus: zeroCounts(BOOKING_STATUSES) },
    attendance: { total: 0, byStatus: zeroCounts(ATTENDANCE_STATUSES), attendanceRate: null },
    revenue: { total: '0.00', byDay: [] as { date: string; amount: string }[] },
    classUtilisation: [] as unknown[],
    coachActivity: [] as unknown[],
    memberships: { activeCount: 0, expiredOrCancelledCount: 0 },
  };
}

function zeroCounts<T extends readonly string[]>(keys: T): Record<T[number], number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<T[number], number>;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves which locations this request is allowed to see.
   * `null` = no restriction (HQ browsing the whole network).
   * An array (possibly empty) = exactly those locations.
   */
  private resolveLocationScope(user: AuthenticatedUser, filters: ReportFilters): string[] | null {
    if (filters.locationId) {
      assertManagesLocation(user, filters.locationId);
      return [filters.locationId];
    }
    if (user.globalRole === GlobalRole.HQ_ADMIN) {
      return null;
    }
    return user.locations
      .filter((l) => l.role === LocationRole.LOCATION_ADMIN)
      .map((l) => l.locationId);
  }

  private resolveDateRange(filters: ReportFilters): { from: Date; to: Date } {
    const to = filters.to ? new Date(filters.to) : new Date();
    const from = filters.from
      ? new Date(filters.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60_000);
    return { from, to };
  }

  async getOverview(filters: ReportFilters, user: AuthenticatedUser) {
    const locationIds = this.resolveLocationScope(user, filters);
    const { from, to } = this.resolveDateRange(filters);

    if (locationIds !== null && locationIds.length === 0) {
      return emptyOverview(from, to);
    }

    const bookings = await this.prisma.client.booking.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        ...(locationIds ? { locationId: { in: locationIds } } : {}),
        ...(filters.serviceId ? { session: { serviceId: filters.serviceId } } : {}),
        ...(filters.coachId ? { session: { coachId: filters.coachId } } : {}),
      },
      include: {
        attendance: true,
        session: {
          include: {
            service: { select: { id: true, name: true, type: true } },
            coach: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    const bookingByStatus = zeroCounts(BOOKING_STATUSES);
    const attendanceByStatus = zeroCounts(ATTENDANCE_STATUSES);
    const revenueByDay = new Map<string, Prisma.Decimal>();
    let revenueTotal = new Prisma.Decimal(0);
    let attendanceMarkedTotal = 0;

    const serviceStats = new Map<
      string,
      { serviceId: string; serviceName: string; type: string; booked: number }
    >();
    const coachStats = new Map<
      string,
      { coachId: string; name: string; sessionsRun: Set<string>; bookingsHandled: number; attendanceMarked: number }
    >();

    for (const b of bookings) {
      bookingByStatus[b.status] = (bookingByStatus[b.status] ?? 0) + 1;

      if (b.attendance) {
        attendanceByStatus[b.attendance.status] = (attendanceByStatus[b.attendance.status] ?? 0) + 1;
        attendanceMarkedTotal += 1;
      }

      if ((REVENUE_STATUSES as readonly string[]).includes(b.status) && b.priceCharged) {
        revenueTotal = revenueTotal.plus(b.priceCharged);
        const dayKey = b.createdAt.toISOString().slice(0, 10);
        revenueByDay.set(dayKey, (revenueByDay.get(dayKey) ?? new Prisma.Decimal(0)).plus(b.priceCharged));
      }

      const service = b.session.service;
      const svcEntry = serviceStats.get(service.id) ?? {
        serviceId: service.id,
        serviceName: service.name,
        type: service.type,
        booked: 0,
      };
      if (b.status === 'CONFIRMED' || b.status === 'COMPLETED' || b.status === 'NO_SHOW') {
        svcEntry.booked += 1;
      }
      serviceStats.set(service.id, svcEntry);

      const coach = b.session.coach;
      if (coach) {
        const coachEntry = coachStats.get(coach.id) ?? {
          coachId: coach.id,
          name: `${coach.firstName} ${coach.lastName}`,
          sessionsRun: new Set<string>(),
          bookingsHandled: 0,
          attendanceMarked: 0,
        };
        coachEntry.sessionsRun.add(b.sessionId);
        coachEntry.bookingsHandled += 1;
        if (b.attendance) coachEntry.attendanceMarked += 1;
        coachStats.set(coach.id, coachEntry);
      }
    }

    // Capacity comes from Session, not Booking — a second pass over the
    // relevant sessions gets total capacity per service for a utilisation %.
    const sessionIds = [...new Set(bookings.map((b) => b.sessionId))];
    const sessions = sessionIds.length
      ? await this.prisma.client.session.findMany({
          where: { id: { in: sessionIds } },
          select: { id: true, serviceId: true, capacity: true },
        })
      : [];
    const capacityByService = new Map<string, number>();
    for (const s of sessions) {
      if (s.capacity != null) {
        capacityByService.set(s.serviceId, (capacityByService.get(s.serviceId) ?? 0) + s.capacity);
      }
    }

    const classUtilisation = [...serviceStats.values()]
      .map((s) => {
        const totalCapacity = capacityByService.get(s.serviceId) ?? null;
        return {
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          type: s.type,
          totalBooked: s.booked,
          totalCapacity,
          utilisationPct:
            totalCapacity && totalCapacity > 0
              ? Math.round((s.booked / totalCapacity) * 1000) / 10
              : null,
        };
      })
      .sort((a, b) => b.totalBooked - a.totalBooked);

    const coachActivity = [...coachStats.values()]
      .map((c) => ({
        coachId: c.coachId,
        name: c.name,
        sessionsRun: c.sessionsRun.size,
        bookingsHandled: c.bookingsHandled,
        attendanceMarked: c.attendanceMarked,
      }))
      .sort((a, b) => b.sessionsRun - a.sessionsRun);

    const memberships = await this.getMembershipCounts(locationIds);

    const totalMarkedForRate = attendanceByStatus.ATTENDED + attendanceByStatus.ABSENT +
      attendanceByStatus.LATE_CANCEL + attendanceByStatus.NO_SHOW;

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      bookings: { total: bookings.length, byStatus: bookingByStatus },
      attendance: {
        total: attendanceMarkedTotal,
        byStatus: attendanceByStatus,
        attendanceRate:
          totalMarkedForRate > 0
            ? Math.round((attendanceByStatus.ATTENDED / totalMarkedForRate) * 1000) / 10
            : null,
      },
      revenue: {
        total: revenueTotal.toFixed(2),
        byDay: [...revenueByDay.entries()]
          .map(([date, amount]) => ({ date, amount: amount.toFixed(2) }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      },
      classUtilisation,
      coachActivity,
      memberships,
    };
  }

  private async getMembershipCounts(locationIds: string[] | null) {
    const planWhere = locationIds
      ? { OR: [{ locationId: { in: locationIds } }, { locationId: null }] }
      : {};

    const [activeCount, expiredOrCancelledCount] = await Promise.all([
      this.prisma.client.userMembership.count({
        where: { status: 'ACTIVE', plan: planWhere },
      }),
      this.prisma.client.userMembership.count({
        where: { status: { in: ['EXPIRED', 'CANCELLED'] }, plan: planWhere },
      }),
    ]);

    return { activeCount, expiredOrCancelledCount };
  }

  /**
   * Booking-level rows for CSV export — same filters/scoping as the overview,
   * but row-per-booking detail rather than aggregates.
   */
  async getExportRows(filters: ReportFilters, user: AuthenticatedUser) {
    const locationIds = this.resolveLocationScope(user, filters);
    const { from, to } = this.resolveDateRange(filters);

    if (locationIds !== null && locationIds.length === 0) {
      return [];
    }

    const bookings = await this.prisma.client.booking.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        ...(locationIds ? { locationId: { in: locationIds } } : {}),
        ...(filters.serviceId ? { session: { serviceId: filters.serviceId } } : {}),
        ...(filters.coachId ? { session: { coachId: filters.coachId } } : {}),
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        location: { select: { name: true } },
        attendance: true,
        session: {
          include: {
            service: { select: { name: true, type: true } },
            coach: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return bookings.map((b) => ({
      bookingDate: b.createdAt.toISOString(),
      sessionStart: b.session.startTime.toISOString(),
      location: b.location.name,
      service: b.session.service.name,
      serviceType: b.session.service.type,
      coach: b.session.coach ? `${b.session.coach.firstName} ${b.session.coach.lastName}` : '',
      golfer: `${b.user.firstName} ${b.user.lastName}`,
      golferEmail: b.user.email,
      bookingStatus: b.status,
      attendanceStatus: b.attendance?.status ?? '',
      priceCharged: b.priceCharged?.toFixed(2) ?? '0.00',
    }));
  }
}
