import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { BookingsService } from './bookings.service.js';
import { CancelBookingDto } from './dto/cancel-booking.dto.js';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('my')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.findMine(user);
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
}
