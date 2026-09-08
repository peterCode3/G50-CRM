import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service.js';
import { SessionsController } from './sessions.controller.js';
import { ServiceSessionsController } from './service-sessions.controller.js';
import { CoachAvailabilityService } from './coach-availability.service.js';
import { CoachAvailabilityController } from './coach-availability.controller.js';

@Module({
  controllers: [SessionsController, ServiceSessionsController, CoachAvailabilityController],
  providers: [SessionsService, CoachAvailabilityService],
})
export class SchedulingModule {}
