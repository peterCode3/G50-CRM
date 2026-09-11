import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service.js';
import { SessionRosterController } from './session-roster.controller.js';
import { BookingAttendanceController } from './booking-attendance.controller.js';

@Module({
  controllers: [SessionRosterController, BookingAttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
