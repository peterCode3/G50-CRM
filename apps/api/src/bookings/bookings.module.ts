import { Module } from '@nestjs/common';
import { CreditsModule } from '../credits/credits.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { BookingsService } from './bookings.service.js';
import { BookingsController } from './bookings.controller.js';
import { SessionBookingsController } from './session-bookings.controller.js';

@Module({
  imports: [CreditsModule, NotificationsModule],
  controllers: [BookingsController, SessionBookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
