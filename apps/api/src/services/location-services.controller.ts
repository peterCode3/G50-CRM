import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { GlobalRole, LocationRole } from '@g50golf/db';
import { Public } from '../auth/public.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { ServicesService } from './services.service.js';
import { ActivateTemplateDto } from './dto/activate-template.dto.js';

@Controller('locations/:locationId/services')
export class LocationServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Public()
  @Get()
  findForLocation(@Param('locationId') locationId: string) {
    return this.servicesService.findForLocation(locationId);
  }

  @Roles(GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN)
  @Post()
  activateTemplate(@Param('locationId') locationId: string, @Body() dto: ActivateTemplateDto) {
    return this.servicesService.activateTemplate(locationId, dto);
  }
}
