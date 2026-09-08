import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ServiceType } from '@g50golf/db';

export class CreateServiceTemplateDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsEnum(ServiceType)
  type!: ServiceType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultDurationMinutes!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultCapacity?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultMemberPrice?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
