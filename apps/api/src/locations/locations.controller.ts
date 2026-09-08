import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { GlobalRole } from '@g50golf/db';
import { Public } from '../auth/public.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { LocationsService } from './locations.service.js';
import { CreateLocationDto } from './dto/create-location.dto.js';
import { UpdateLocationDto } from './dto/update-location.dto.js';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Public()
  @Get()
  findActive() {
    return this.locationsService.findActive();
  }

  // Static path registered before ':id' so it isn't swallowed by the param route.
  @Roles(GlobalRole.HQ_ADMIN)
  @Get('admin/all')
  findAll() {
    return this.locationsService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.locationsService.findOne(id);
  }

  @Roles(GlobalRole.HQ_ADMIN)
  @Post()
  create(@Body() dto: CreateLocationDto) {
    return this.locationsService.create(dto);
  }

  @Roles(GlobalRole.HQ_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.locationsService.update(id, dto);
  }

  @Roles(GlobalRole.HQ_ADMIN)
  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.locationsService.setActive(id, true);
  }

  @Roles(GlobalRole.HQ_ADMIN)
  @Post(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.locationsService.setActive(id, false);
  }
}
