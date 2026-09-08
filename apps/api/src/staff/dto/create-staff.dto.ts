import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { LocationRole } from '@g50golf/db';

export class CreateStaffDto {
  @IsEmail()
  email!: string;

  // Only required when the email doesn't already belong to an existing user —
  // enforced in the service, since class-validator can't see other fields' values.
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  locationId!: string;

  @IsIn([LocationRole.LOCATION_ADMIN, LocationRole.COACH])
  role!: 'LOCATION_ADMIN' | 'COACH';
}
