import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { GlobalRole, LocationRole } from '@g50golf/db';
import { Roles } from '../auth/roles.decorator.js';
import { ServiceTemplatesService } from './service-templates.service.js';
import { CreateServiceTemplateDto } from './dto/create-service-template.dto.js';
import { UpdateServiceTemplateDto } from './dto/update-service-template.dto.js';

// Browsing the catalog is available to HQ and to any location admin (at any of
// their locations) — there's no single locationId in play here, it's "can this
// user activate templates somewhere", not "at this specific location".
const CAN_BROWSE = [GlobalRole.HQ_ADMIN, LocationRole.LOCATION_ADMIN];

@Controller('service-templates')
export class ServiceTemplatesController {
  constructor(private readonly service: ServiceTemplatesService) {}

  @Roles(...CAN_BROWSE)
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Roles(...CAN_BROWSE)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(GlobalRole.HQ_ADMIN)
  @Post()
  create(@Body() dto: CreateServiceTemplateDto) {
    return this.service.create(dto);
  }

  @Roles(GlobalRole.HQ_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateServiceTemplateDto) {
    return this.service.update(id, dto);
  }
}
