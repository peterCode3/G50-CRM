import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { GlobalRole, LocationRole } from '@g50golf/db';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { CustomersService } from './customers.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';

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

  // HQ-only: a manually-created account has no bookings yet, so there's no
  // location for a Location Admin to be scoped against until it books
  // somewhere — keeping creation HQ-only sidesteps that edge case cleanly.
  @Roles(GlobalRole.HQ_ADMIN)
  @Post()
  createCustomer(@Body() dto: CreateCustomerDto) {
    return this.customersService.createCustomer(dto);
  }

  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN)
  @Get(':id')
  findOneForAdmin(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.findOneForAdmin(id, user);
  }

  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN)
  @Patch(':id')
  updateCustomer(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customersService.updateCustomer(id, dto, user);
  }
}
