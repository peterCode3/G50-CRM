import { IsEnum } from 'class-validator';
import { AttendanceStatus } from '@g50golf/db';

export class MarkAttendanceDto {
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;
}
