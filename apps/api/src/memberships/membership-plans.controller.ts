import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { GlobalRole } from '@g50golf/db';
import { Public } from '../auth/public.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { MembershipPlansService } from './membership-plans.service.js';
import { CreateMembershipPlanDto } from './dto/create-membership-plan.dto.js';
import { UpdateMembershipPlanDto } from './dto/update-membership-plan.dto.js';
import { SubscribeMembershipDto } from './dto/subscribe-membership.dto.js';

@Controller('membership-plans')
export class MembershipPlansController {
  constructor(private readonly service: MembershipPlansService) {}

  @Public()
  @Get()
  findActive(@Query('locationId') locationId?: string) {
    return this.service.findActive(locationId);
  }

  // Static path registered before ':id' so it isn't swallowed by the param route.
  @Roles(GlobalRole.HQ_ADMIN)
  @Get('admin/all')
  findAll() {
    return this.service.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(GlobalRole.HQ_ADMIN)
  @Post()
  create(@Body() dto: CreateMembershipPlanDto) {
    return this.service.create(dto);
  }

  @Roles(GlobalRole.HQ_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMembershipPlanDto) {
    return this.service.update(id, dto);
  }

  // No @Roles() — any authenticated golfer can subscribe themselves.
  @Post(':id/subscribe')
  subscribe(
    @Param('id') id: string,
    @Body() dto: SubscribeMembershipDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.subscribe(id, user, dto.autoRenew ?? false);
  }
}
