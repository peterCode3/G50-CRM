import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ServiceType } from '@g50golf/db';

export class CreateCreditPackageDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  creditsIncluded!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsEnum(ServiceType)
  eligibleServiceType?: ServiceType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expiryDays?: number;

  // Omit for a network-wide package; set to scope it to one location.
  @IsOptional()
  @IsString()
  locationId?: string;
}
