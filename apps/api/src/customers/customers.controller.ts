import { Controller, Get, Param, Query } from '@nestjs/common';
import { GlobalRole, LocationRole } from '@g50golf/db';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { CustomersService } from './customers.service.js';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  // Static path registered before ':id' so it isn't swallowed by the param route.
  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN)
  @Get('admin/all')
  findAllForAdmin(
    @CurrentUser() user: AuthenticatedUser,
    @Query('locationId') locationId?: string,
    @Query('search') search?: string,
  ) {
    return this.customersService.findAllForAdmin({ locationId, search }, user);
  }

  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN)
  @Get(':id')
  findOneForAdmin(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.findOneForAdmin(id, user);
  }
}
