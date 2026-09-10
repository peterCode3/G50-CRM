import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateCreditPackageDto } from './create-credit-package.dto.js';

export class UpdateCreditPackageDto extends PartialType(CreateCreditPackageDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
