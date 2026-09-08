import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class CreateCoachAvailabilityDto {
  // Omitted when a coach is managing their own availability; required when
  // HQ/Location Admin is setting it on behalf of a coach.
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  locationId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'startTime must be in HH:mm 24h format' })
  startTime!: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'endTime must be in HH:mm 24h format' })
  endTime!: string;

  @IsOptional()
  @IsBoolean()
  isTimeOff?: boolean;
}
