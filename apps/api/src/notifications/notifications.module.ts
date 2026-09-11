import { Module } from '@nestjs/common';
import { MailService } from './mail.service.js';
import { NotificationsService } from './notifications.service.js';
import { RemindersService } from './reminders.service.js';

@Module({
  providers: [MailService, NotificationsService, RemindersService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
