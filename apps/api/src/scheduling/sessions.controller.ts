import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { GlobalRole, LocationRole } from '@g50golf/db';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { SessionsService } from './sessions.service.js';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Roles(GlobalRole.COACH)
  @Get('my')
  findMyUpcoming(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.findMyUpcoming(user);
  }

  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN)
  @Get('summary')
  findUpcomingSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: string,
  ) {
    return this.sessionsService.findUpcomingSummary(user, days ? Number(days) : undefined);
  }

  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN)
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.cancel(id, user);
  }
}
