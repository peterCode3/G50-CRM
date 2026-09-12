import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { GlobalRole, LocationRole } from '@g50golf/db';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { BookingsService } from './bookings.service.js';
import { CancelBookingDto } from './dto/cancel-booking.dto.js';
import { RescheduleBookingDto } from './dto/reschedule-booking.dto.js';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('my')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.findMine(user);
  }

  // Static path registered before ':id' so it isn't swallowed by the param route.
  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN)
  @Get('admin/all')
  findAllForAdmin(
    @CurrentUser() user: AuthenticatedUser,
    @Query('locationId') locationId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
  ) {
    return this.bookingsService.findAllForAdmin({ locationId, status, from, to, search }, user);
  }

  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN, GlobalRole.COACH)
  @Get('pending')
  findPendingForUser(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.findPendingForUser(user);
  }

  // No @Roles() — ownership (or HQ/Location Admin) is checked in the service,
  // since this route has no locationId param for RolesGuard to scope against.
  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.cancel(id, dto, user);
  }

  // No @Roles() — ownership (or HQ/Location Admin) is checked in the service.
  @Post(':id/reschedule')
  reschedule(
    @Param('id') id: string,
    @Body() dto: RescheduleBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.reschedule(id, dto, user);
  }

  // No @Roles() — assertCanManageSession (coach assigned, or HQ/Location Admin) is checked in the service.
  @Post(':id/accept')
  accept(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.accept(id, user);
  }

  @Post(':id/decline')
  decline(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.decline(id, dto, user);
  }
}
