import { Module } from '@nestjs/common';
import { MembershipPlansService } from './membership-plans.service.js';
import { MembershipPlansController } from './membership-plans.controller.js';
import { MyMembershipsController } from './my-memberships.controller.js';

@Module({
  controllers: [MembershipPlansController, MyMembershipsController],
  providers: [MembershipPlansService],
  exports: [MembershipPlansService],
})
export class MembershipsModule {}
