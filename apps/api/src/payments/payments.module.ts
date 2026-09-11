import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { StripeClientService } from './stripe-client.service.js';

@Module({
  imports: [BookingsModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeClientService],
})
export class PaymentsModule {}
