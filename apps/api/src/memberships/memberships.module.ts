import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { MembershipPlansService } from './membership-plans.service.js';
import { MembershipPlansController } from './membership-plans.controller.js';
import { MyMembershipsController } from './my-memberships.controller.js';
import { MembershipRenewalService } from './membership-renewal.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [MembershipPlansController, MyMembershipsController],
  providers: [MembershipPlansService, MembershipRenewalService],
  exports: [MembershipPlansService],
})
export class MembershipsModule {}
