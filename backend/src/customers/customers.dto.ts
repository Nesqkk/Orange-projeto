import { IsString, MaxLength } from 'class-validator';

export class UpdateCustomerDto {
  @IsString()
  @MaxLength(120)
  name!: string;
}
