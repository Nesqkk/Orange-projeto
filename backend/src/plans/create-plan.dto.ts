import { IsEnum, IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PlanInterval } from '../generated/prisma/client.js';

export class CreatePlanDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsInt()
  @Min(0)
  @Max(100_000_000)
  priceInCents!: number;

  @IsEnum(PlanInterval)
  interval!: PlanInterval;
}
