import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { CreditsModule } from '../credits/credits.module.js';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';

@Module({
  imports: [NotificationsModule, CreditsModule],
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
