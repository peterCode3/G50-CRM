import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { GlobalRole, LocationRole } from '@g50golf/db';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { StaffService } from './staff.service.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';

@Controller()
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN)
  @Post('staff')
  create(@Body() dto: CreateStaffDto) {
    return this.staffService.createStaff(dto);
  }

  // Static path registered before the more specific staff/:userId/... routes.
  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN)
  @Get('staff/admin/all')
  findAllForAdmin(
    @CurrentUser() user: AuthenticatedUser,
    @Query('locationId') locationId?: string,
    @Query('search') search?: string,
  ) {
    return this.staffService.findAllForAdmin({ locationId, search }, user);
  }

  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN)
  @Get('staff/:userId')
  findOneForAdmin(@Param('userId') userId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.staffService.findOneForAdmin(userId, user);
  }

  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN)
  @Delete('staff/:userId/locations/:locationId/roles/:role')
  removeRole(
    @Param('userId') userId: string,
    @Param('locationId') locationId: string,
    @Param('role') role: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staffService.removeRole(userId, locationId, role as LocationRole, user);
  }

  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN)
  @Get('locations/:locationId/staff')
  findForLocation(@Param('locationId') locationId: string) {
    return this.staffService.findForLocation(locationId);
  }
}
