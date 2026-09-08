import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller.js';
import { LocationServicesController } from './location-services.controller.js';
import { ServicesService } from './services.service.js';

@Module({
  controllers: [ServicesController, LocationServicesController],
  providers: [ServicesService],
})
export class ServicesModule {}
