import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { GlobalRole, LocationRole } from '@g50golf/db';
import { Public } from '../auth/public.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { SessionsService } from './sessions.service.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { CreateRecurringSessionsDto } from './dto/create-recurring-sessions.dto.js';

@Controller('services/:serviceId/sessions')
export class ServiceSessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Public()
  @Get()
  findForService(
    @Param('serviceId') serviceId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.sessionsService.findForService(serviceId, from, to);
  }

  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN)
  @Post()
  createOne(
    @Param('serviceId') serviceId: string,
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessionsService.createOne(serviceId, dto, user);
  }

  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN)
  @Post('recurring')
  createRecurring(
    @Param('serviceId') serviceId: string,
    @Body() dto: CreateRecurringSessionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessionsService.createRecurring(serviceId, dto, user);
  }
}
