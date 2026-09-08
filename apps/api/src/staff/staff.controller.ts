import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { GlobalRole, LocationRole } from '@g50golf/db';
import { Roles } from '../auth/roles.decorator.js';
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

  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN)
  @Get('locations/:locationId/staff')
  findForLocation(@Param('locationId') locationId: string) {
    return this.staffService.findForLocation(locationId);
  }
}
