import { Module } from '@nestjs/common';
import { ServiceTemplatesController } from './service-templates.controller.js';
import { ServiceTemplatesService } from './service-templates.service.js';

@Module({
  controllers: [ServiceTemplatesController],
  providers: [ServiceTemplatesService],
  exports: [ServiceTemplatesService],
})
export class ServiceTemplatesModule {}
