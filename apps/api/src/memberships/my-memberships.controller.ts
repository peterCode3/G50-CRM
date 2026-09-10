import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { MembershipPlansService } from './membership-plans.service.js';

@Controller('memberships')
export class MyMembershipsController {
  constructor(private readonly service: MembershipPlansService) {}

  @Get('my')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findMine(user);
  }
}
