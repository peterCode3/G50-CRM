import { Module } from '@nestjs/common';
import { WaitlistService } from './waitlist.service.js';
import { WaitlistController } from './waitlist.controller.js';
import { SessionWaitlistController } from './session-waitlist.controller.js';

@Module({
  controllers: [WaitlistController, SessionWaitlistController],
  providers: [WaitlistService],
})
export class WaitlistModule {}
