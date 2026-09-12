import { IsBoolean, IsOptional } from 'class-validator';

export class SubscribeMembershipDto {
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}
