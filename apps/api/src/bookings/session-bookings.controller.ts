import { Controller, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { BookingsService } from './bookings.service.js';

@Controller('sessions/:sessionId/bookings')
export class SessionBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // No @Roles() — any authenticated user can book a session for themselves.
  @Post()
  create(@Param('sessionId') sessionId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.create(sessionId, user);
  }
}
