import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { GlobalRole, LocationRole, Prisma } from '@g50golf/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertManagesLocation } from '../auth/location-access.util.js';
import type { AuthenticatedUser } from '../auth/types.js';
import type { CreateSessionDto } from './dto/create-session.dto.js';
import type { CreateRecurringSessionsDto } from './dto/create-recurring-sessions.dto.js';

interface SessionInput {
  serviceId: string;
  locationId: string;
  coachId?: string;
  startTime: Date;
  endTime: Date;
  capacity: number | null;
  recurrenceRule?: string;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
}

/** Spec §2/§4: a service can require sessions to start on a fixed grid (e.g. every 15 min). */
function assertAlignedToInterval(startTime: Date, bookingIntervalMinutes: number | null): void {
  if (!bookingIntervalMinutes) return;
  const minutesSinceMidnight = startTime.getUTCHours() * 60 + startTime.getUTCMinutes();
  if (minutesSinceMidnight % bookingIntervalMinutes !== 0) {
    throw new BadRequestException(
      `This service only accepts start times on a ${bookingIntervalMinutes}-minute grid`,
    );
  }
}

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createOne(serviceId: string, dto: CreateSessionDto, user: AuthenticatedUser) {
    const service = await this.getServiceOrThrow(serviceId);
    assertManagesLocation(user, service.locationId);

    const startTime = new Date(dto.startTime);
    const endTime = new Date(startTime.getTime() + service.durationMinutes * 60_000);
    assertAlignedToInterval(startTime, service.bookingIntervalMinutes);

    return this.createSessionSafely({
      serviceId: service.id,
      locationId: service.locationId,
      coachId: dto.coachId,
      startTime,
      endTime,
      capacity: dto.capacity ?? service.capacity,
      bufferBeforeMinutes: service.bufferBeforeMinutes,
      bufferAfterMinutes: service.bufferAfterMinutes,
    });
  }

  async createRecurring(
    serviceId: string,
    dto: CreateRecurringSessionsDto,
    user: AuthenticatedUser,
  ) {
    const service = await this.getServiceOrThrow(serviceId);
    assertManagesLocation(user, service.locationId);

    const [hour, minute] = dto.startTime.split(':').map(Number);
    assertAlignedToInterval(
      new Date(Date.UTC(1970, 0, 1, hour, minute)),
      service.bookingIntervalMinutes,
    );
    const rangeStart = new Date(`${dto.rangeStart}T00:00:00.000Z`);
    const rangeEnd = new Date(`${dto.rangeEnd}T00:00:00.000Z`);

    const created: { id: string; startTime: Date }[] = [];
    const skipped: { startTime: Date; reason: string }[] = [];
    const recurrenceRule = `WEEKLY:${dto.daysOfWeek.join(',')}@${dto.startTime}`;

    for (
      let day = new Date(rangeStart);
      day <= rangeEnd;
      day = new Date(day.getTime() + 24 * 60 * 60_000)
    ) {
      if (!dto.daysOfWeek.includes(day.getUTCDay())) {
        continue;
      }

      const startTime = new Date(
        Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute),
      );
      const endTime = new Date(startTime.getTime() + service.durationMinutes * 60_000);

      try {
        const session = await this.createSessionSafely({
          serviceId: service.id,
          locationId: service.locationId,
          coachId: dto.coachId,
          startTime,
          endTime,
          capacity: dto.capacity ?? service.capacity,
          recurrenceRule,
          bufferBeforeMinutes: service.bufferBeforeMinutes,
          bufferAfterMinutes: service.bufferAfterMinutes,
        });
        created.push({ id: session.id, startTime: session.startTime });
      } catch (err) {
        if (err instanceof ConflictException) {
          skipped.push({ startTime, reason: err.message });
        } else {
          throw err;
        }
      }
    }

    return { createdCount: created.length, created, skipped };
  }

  async findForService(serviceId: string, from?: string, to?: string) {
    const sessions = await this.prisma.client.session.findMany({
      where: {
        serviceId,
        isCancelled: false,
        ...(from || to
          ? {
              startTime: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: {
        // PENDING holds the seat exactly like CONFIRMED does (an appointment
        // awaiting the coach's decision still blocks the slot) — see
        // BookingsService.create's SEAT_HOLDING_STATUSES.
        _count: { select: { bookings: { where: { status: { in: ['CONFIRMED', 'PENDING'] } } } } },
        coach: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    // Surface remaining capacity (spec §9: "Display remaining class capacity")
    // without exposing raw booking rows on a public endpoint.
    return sessions.map(({ _count, ...session }) => ({
      ...session,
      bookedCount: _count.bookings,
      spotsLeft: session.capacity != null ? session.capacity - _count.bookings : null,
    }));
  }

  findMyUpcoming(user: AuthenticatedUser) {
    return this.prisma.client.session.findMany({
      where: {
        coachId: user.id,
        isCancelled: false,
        endTime: { gte: new Date() },
      },
      include: { service: true, location: true },
      orderBy: { startTime: 'asc' },
    });
  }

  /**
   * Aggregates upcoming sessions for the dashboard charts: HQ sees the whole
   * network, a Location Admin sees only the location(s) they manage. Returns
   * empty series (not an error) for a caller who manages nothing yet.
   */
  async findUpcomingSummary(user: AuthenticatedUser, days = 14) {
    const managedLocationIds =
      user.globalRole === GlobalRole.HQ_ADMIN
        ? null // null = no location filter, i.e. the whole network
        : user.locations
            .filter((l) => l.role === LocationRole.LOCATION_ADMIN)
            .map((l) => l.locationId);

    if (managedLocationIds && managedLocationIds.length === 0) {
      return { byDay: [], byLocation: [] };
    }

    const now = new Date();
    const rangeEnd = new Date(now.getTime() + days * 24 * 60 * 60_000);

    const sessions = await this.prisma.client.session.findMany({
      where: {
        isCancelled: false,
        startTime: { gte: now, lte: rangeEnd },
        ...(managedLocationIds ? { locationId: { in: managedLocationIds } } : {}),
      },
      include: { location: { select: { id: true, name: true } } },
      orderBy: { startTime: 'asc' },
    });

    const byDayMap = new Map<string, number>();
    const byLocationMap = new Map<string, { name: string; count: number }>();

    for (const s of sessions) {
      const dayKey = s.startTime.toISOString().slice(0, 10);
      byDayMap.set(dayKey, (byDayMap.get(dayKey) ?? 0) + 1);

      const loc = byLocationMap.get(s.location.id) ?? { name: s.location.name, count: 0 };
      loc.count += 1;
      byLocationMap.set(s.location.id, loc);
    }

    return {
      byDay: [...byDayMap.entries()]
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      byLocation: [...byLocationMap.entries()]
        .map(([locationId, v]) => ({ locationId, locationName: v.name, count: v.count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  async cancel(id: string, user: AuthenticatedUser) {
    const session = await this.prisma.client.session.findUnique({ where: { id } });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    assertManagesLocation(user, session.locationId);
    return this.prisma.client.session.update({ where: { id }, data: { isCancelled: true } });
  }

  private async getServiceOrThrow(serviceId: string) {
    const service = await this.prisma.client.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return service;
  }

  /**
   * Atomically checks for an overlapping session for the same coach and
   * creates the new one — wrapped in a SERIALIZABLE transaction so concurrent
   * requests can't both pass the check and double-book a coach (spec §18:
   * "Coach scheduling must prevent double-booking"). Postgres aborts one side
   * of a genuine race with a serialization failure (P2034), which we surface
   * as the same 409 a plain overlap would produce.
   */
  private async createSessionSafely(input: SessionInput) {
    try {
      return await this.prisma.client.$transaction(
        async (tx) => {
          if (input.coachId) {
            // Pad this session's own window by its buffer times (spec §2/§4:
            // "buffer time before/after") so a conflict is caught even when the
            // two sessions' raw start/end times don't literally overlap.
            // Simplification: only this session's buffers widen the check —
            // an existing session's own buffer isn't re-applied here.
            const paddedStart = new Date(
              input.startTime.getTime() - (input.bufferBeforeMinutes ?? 0) * 60_000,
            );
            const paddedEnd = new Date(
              input.endTime.getTime() + (input.bufferAfterMinutes ?? 0) * 60_000,
            );
            const conflict = await tx.session.findFirst({
              where: {
                coachId: input.coachId,
                isCancelled: false,
                startTime: { lt: paddedEnd },
                endTime: { gt: paddedStart },
              },
            });
            if (conflict) {
              throw new ConflictException(
                `Coach is already booked from ${conflict.startTime.toISOString()} to ${conflict.endTime.toISOString()}`,
              );
            }

            const timeOff = await this.findTimeOffConflict(
              tx,
              input.coachId,
              input.locationId,
              paddedStart,
              paddedEnd,
            );
            if (timeOff) {
              throw new ConflictException(
                `Coach is marked as unavailable from ${timeOff.startTime} to ${timeOff.endTime} on this day`,
              );
            }
          }

          // bufferBeforeMinutes/bufferAfterMinutes live on Service, not
          // Session — they're only carried on `input` to widen the conflict
          // check above, and must not be spread into session.create's data.
          const { bufferBeforeMinutes: _before, bufferAfterMinutes: _after, ...sessionData } = input;
          return tx.session.create({ data: sessionData });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      if (err instanceof ConflictException) {
        throw err;
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
        throw new ConflictException(
          'This coach was just booked for an overlapping session — please retry',
        );
      }
      throw err;
    }
  }

  /**
   * Checks a coach's declared time-off (spec §4) against a candidate session
   * window. `CoachAvailability` rows store either a specific `date` (one-off
   * time off) or a recurring `dayOfWeek`, plus a plain "HH:mm" start/end —
   * interpreted in UTC, matching how recurring sessions are built from
   * hour/minute above (`Date.UTC(...)`). Same-day sessions only; a session
   * spanning midnight is evaluated against its start day.
   */
  private async findTimeOffConflict(
    tx: Prisma.TransactionClient,
    coachId: string,
    locationId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<{ startTime: string; endTime: string } | null> {
    const dayOfWeek = startTime.getUTCDay();
    const dateOnly = new Date(
      Date.UTC(startTime.getUTCFullYear(), startTime.getUTCMonth(), startTime.getUTCDate()),
    );

    const entries = await tx.coachAvailability.findMany({
      where: {
        userId: coachId,
        locationId,
        isTimeOff: true,
        OR: [{ dayOfWeek }, { date: dateOnly }],
      },
    });
    if (entries.length === 0) {
      return null;
    }

    const toMinutes = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };
    const sessionStartMin = startTime.getUTCHours() * 60 + startTime.getUTCMinutes();
    const sessionEndMin = endTime.getUTCHours() * 60 + endTime.getUTCMinutes();

    return (
      entries.find((entry) => {
        const offStart = toMinutes(entry.startTime);
        const offEnd = toMinutes(entry.endTime);
        return sessionStartMin < offEnd && sessionEndMin > offStart;
      }) ?? null
    );
  }
}
