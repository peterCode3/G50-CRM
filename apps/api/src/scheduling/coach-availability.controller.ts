import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { GlobalRole, LocationRole } from '@g50golf/db';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { CoachAvailabilityService } from './coach-availability.service.js';
import { CreateCoachAvailabilityDto } from './dto/create-coach-availability.dto.js';

const CAN_MANAGE = [GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN, LocationRole.COACH];

@Controller()
export class CoachAvailabilityController {
  constructor(private readonly service: CoachAvailabilityService) {}

  @Roles(...CAN_MANAGE)
  @Post('coach-availability')
  create(@Body() dto: CreateCoachAvailabilityDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  @Roles(...CAN_MANAGE)
  @Get('locations/:locationId/coach-availability')
  findForCoach(
    @Param('locationId') locationId: string,
    @Query('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findForCoachAtLocation(userId ?? user.id, locationId, user);
  }

  @Roles(...CAN_MANAGE)
  @Delete('coach-availability/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user);
  }
}
