import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@g50golf/db';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/types.js';

@Injectable()
export class WaitlistService {
  constructor(private readonly prisma: PrismaService) {}

  async join(sessionId: string, user: AuthenticatedUser) {
    const session = await this.prisma.client.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    if (session.isCancelled) {
      throw new BadRequestException('This session has been cancelled');
    }
    if (session.startTime <= new Date()) {
      throw new BadRequestException('This session has already started');
    }

    if (session.capacity != null) {
      const confirmedCount = await this.prisma.client.booking.count({
        where: { sessionId, status: 'CONFIRMED' },
      });
      if (confirmedCount < session.capacity) {
        throw new BadRequestException('This session has room — book it directly instead');
      }
    }

    const existing = await this.prisma.client.waitlistEntry.findFirst({
      where: { sessionId, userId: user.id, status: { in: ['WAITING', 'NOTIFIED'] } },
    });
    if (existing) {
      throw new ConflictException('You are already on the waitlist for this session');
    }

    const lastPosition = await this.prisma.client.waitlistEntry.findFirst({
      where: { sessionId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    return this.prisma.client.waitlistEntry.create({
      data: { sessionId, userId: user.id, position: (lastPosition?.position ?? 0) + 1 },
    });
  }

  findMine(user: AuthenticatedUser) {
    return this.prisma.client.waitlistEntry.findMany({
      where: { userId: user.id, status: { in: ['WAITING', 'NOTIFIED'] } },
      include: { session: { include: { service: true, location: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Converts a NOTIFIED waitlist entry into a real Booking. Same
   * SERIALIZABLE-transaction capacity recheck as BookingsService.create —
   * the notify step doesn't reserve the spot, so it's rechecked here too.
   */
  async claim(id: string, user: AuthenticatedUser) {
    const entry = await this.prisma.client.waitlistEntry.findUnique({
      where: { id },
      include: { session: { include: { service: true } } },
    });
    if (!entry) {
      throw new NotFoundException('Waitlist entry not found');
    }
    if (entry.userId !== user.id) {
      throw new ForbiddenException('This is not your waitlist entry');
    }
    if (entry.status !== 'NOTIFIED') {
      throw new BadRequestException(
        entry.status === 'CLAIMED'
          ? 'You have already claimed this spot'
          : 'You have not been notified of an open spot yet',
      );
    }
    if (entry.session.startTime <= new Date()) {
      throw new BadRequestException('This session has already started');
    }

    try {
      return await this.prisma.client.$transaction(
        async (tx) => {
          if (entry.session.capacity != null) {
            const confirmedCount = await tx.booking.count({
              where: { sessionId: entry.sessionId, status: 'CONFIRMED' },
            });
            if (confirmedCount >= entry.session.capacity) {
              throw new ConflictException('That spot has already been taken');
            }
          }

          const booking = await tx.booking.create({
            data: {
              sessionId: entry.sessionId,
              userId: user.id,
              locationId: entry.session.locationId,
              status: 'CONFIRMED',
              priceCharged: entry.session.service.price,
            },
          });

          await tx.waitlistEntry.update({ where: { id }, data: { status: 'CLAIMED' } });

          return booking;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      if (err instanceof ConflictException) {
        throw err;
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
        throw new ConflictException('That spot has already been taken');
      }
      throw err;
    }
  }
}
