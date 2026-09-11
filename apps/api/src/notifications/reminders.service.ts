import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';

// A 2-hour-wide window checked every hour comfortably covers any single
// booking exactly once, however the cron's exact minute lines up against a
// session's start time — reminderSentAt then makes re-checks idempotent.
const WINDOW_START_MS = 23 * 60 * 60_000;
const WINDOW_END_MS = 25 * 60 * 60_000;

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sendUpcomingReminders() {
    const now = new Date();
    const windowStart = new Date(now.getTime() + WINDOW_START_MS);
    const windowEnd = new Date(now.getTime() + WINDOW_END_MS);

    const bookings = await this.prisma.client.booking.findMany({
      where: {
        status: 'CONFIRMED',
        reminderSentAt: null,
        session: { startTime: { gte: windowStart, lte: windowEnd }, isCancelled: false },
      },
      include: { user: true, session: { include: { service: true } } },
    });

    for (const booking of bookings) {
      await this.notifications.bookingReminder(
        booking.user,
        booking.session.service.name,
        booking.session.startTime,
      );
      await this.prisma.client.booking.update({
        where: { id: booking.id },
        data: { reminderSentAt: new Date() },
      });
    }

    if (bookings.length > 0) {
      this.logger.log(`Sent ${bookings.length} booking reminder(s)`);
    }
  }
}
