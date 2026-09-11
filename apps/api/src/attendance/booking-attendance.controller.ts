import { Body, Controller, Param, Post } from '@nestjs/common';
import { GlobalRole, LocationRole } from '@g50golf/db';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { AttendanceService } from './attendance.service.js';
import { MarkAttendanceDto } from './dto/mark-attendance.dto.js';

@Controller('bookings/:id/attendance')
export class BookingAttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN, GlobalRole.COACH)
  @Post()
  markAttendance(
    @Param('id') id: string,
    @Body() dto: MarkAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.markAttendance(id, dto.status, user);
  }
}
