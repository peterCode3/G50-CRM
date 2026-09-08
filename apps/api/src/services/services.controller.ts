import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { GlobalRole, LocationRole } from '@g50golf/db';
import { Public } from '../auth/public.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { ServicesService } from './services.service.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  // Coarse gate here (must be HQ or *a* location admin somewhere); the precise
  // "do you manage *this* service's location" check happens inside the service
  // layer, since this route has no locationId param to check against directly.
  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.servicesService.update(id, dto, user);
  }
}
