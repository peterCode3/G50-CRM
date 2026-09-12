import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
