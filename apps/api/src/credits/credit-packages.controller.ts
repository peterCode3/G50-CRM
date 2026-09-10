import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { GlobalRole } from '@g50golf/db';
import { Public } from '../auth/public.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { CreditsService } from './credits.service.js';
import { CreateCreditPackageDto } from './dto/create-credit-package.dto.js';
import { UpdateCreditPackageDto } from './dto/update-credit-package.dto.js';

@Controller('credit-packages')
export class CreditPackagesController {
  constructor(private readonly service: CreditsService) {}

  @Public()
  @Get()
  findActive(@Query('locationId') locationId?: string) {
    return this.service.findActive(locationId);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(GlobalRole.HQ_ADMIN)
  @Post()
  create(@Body() dto: CreateCreditPackageDto) {
    return this.service.create(dto);
  }

  @Roles(GlobalRole.HQ_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCreditPackageDto) {
    return this.service.update(id, dto);
  }

  // No @Roles() — any authenticated golfer can purchase for themselves.
  @Post(':id/purchase')
  purchase(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.purchase(id, user);
  }
}
