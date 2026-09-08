import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service.js';
import { BookingsController } from './bookings.controller.js';
import { SessionBookingsController } from './session-bookings.controller.js';

@Module({
  controllers: [BookingsController, SessionBookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
