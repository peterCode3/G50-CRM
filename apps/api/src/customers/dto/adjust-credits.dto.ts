import { IsInt, IsString, MinLength, NotEquals } from 'class-validator';

export class AdjustCreditsDto {
  @IsInt()
  @NotEquals(0)
  delta!: number;

  @IsString()
  @MinLength(1)
  reason!: string;
}
