import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PlanInterval } from '../generated/prisma/client.js';

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  priceInCents?: number;

  @IsOptional()
  @IsEnum(PlanInterval)
  interval?: PlanInterval;
}
