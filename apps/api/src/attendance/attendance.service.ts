import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus } from '@g50golf/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertCanManageSession } from '../auth/location-access.util.js';
import type { AuthenticatedUser } from '../auth/types.js';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getRoster(sessionId: string, user: AuthenticatedUser) {
    const session = await this.prisma.client.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    assertCanManageSession(user, session);

    const bookings = await this.prisma.client.booking.findMany({
      where: { sessionId, status: { in: ['CONFIRMED', 'COMPLETED', 'NO_SHOW'] } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        attendance: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return bookings.map((b) => ({
      bookingId: b.id,
      userId: b.user.id,
      firstName: b.user.firstName,
      lastName: b.user.lastName,
      email: b.user.email,
      bookingStatus: b.status,
      attendanceStatus: b.attendance?.status ?? null,
    }));
  }

  async markAttendance(bookingId: string, status: AttendanceStatus, user: AuthenticatedUser) {
    const booking = await this.prisma.client.booking.findUnique({
      where: { id: bookingId },
      include: { session: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    assertCanManageSession(user, booking.session);

    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Cannot record attendance for a cancelled booking');
    }

    await this.prisma.client.attendance.upsert({
      where: { bookingId },
      create: { bookingId, status, recordedById: user.id },
      update: { status, recordedById: user.id, recordedAt: new Date() },
    });

    // Reflect the outcome on the booking itself too, so a golfer's booking
    // history shows what actually happened rather than sitting at CONFIRMED
    // forever. The Attendance row remains the precise record (which of the
    // non-attended reasons applied); Booking only distinguishes
    // attended vs. not.
    await this.prisma.client.booking.update({
      where: { id: bookingId },
      data: { status: status === AttendanceStatus.ATTENDED ? 'COMPLETED' : 'NO_SHOW' },
    });

    return { bookingId, attendanceStatus: status };
  }
}
