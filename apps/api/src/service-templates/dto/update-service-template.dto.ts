import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateServiceTemplateDto } from './create-service-template.dto.js';

export class UpdateServiceTemplateDto extends PartialType(CreateServiceTemplateDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
