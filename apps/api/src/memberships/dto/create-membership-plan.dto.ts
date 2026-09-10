import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { BillingPeriod, MembershipType } from '@g50golf/db';

export class CreateMembershipPlanDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(MembershipType)
  type!: MembershipType;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsEnum(BillingPeriod)
  billingPeriod?: BillingPeriod;

  // Omit for a network-wide (global) plan; set to scope it to one location.
  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsBoolean()
  crossLocationAccess?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bookingWindowDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  includedCredits?: number;
}
