import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GlobalRole, LocationRole, Prisma } from '@g50golf/db';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/types.js';
import type { CancelBookingDto } from './dto/cancel-booking.dto.js';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Capacity-safe booking creation — same SERIALIZABLE-transaction pattern as
   * SessionsService's coach double-booking check (Phase 3), applied here to
   * counting CONFIRMED bookings against Session.capacity instead of coach
   * time overlap. Concurrent requests for the last spot can't both succeed:
   * Postgres aborts one with a serialization failure (P2034), surfaced as the
   * same 409 a plain capacity check would give.
   */
  async create(sessionId: string, user: AuthenticatedUser) {
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

          return tx.booking.create({
            data: {
              sessionId,
              userId: user.id,
              locationId: session.locationId,
              status: 'CONFIRMED',
              priceCharged: session.service.price,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      if (err instanceof ConflictException) {
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

    const cancelled = await this.prisma.client.booking.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: dto.reason },
    });

    // A confirmed spot just freed up — notify the next person in the waitlist
    // queue (spec §10: notify+claim, not fully automatic promotion for V1).
    const nextInLine = await this.prisma.client.waitlistEntry.findFirst({
      where: { sessionId: booking.sessionId, status: 'WAITING' },
      orderBy: { position: 'asc' },
    });
    if (nextInLine) {
      await this.prisma.client.waitlistEntry.update({
        where: { id: nextInLine.id },
        data: { status: 'NOTIFIED', notifiedAt: new Date() },
      });
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
