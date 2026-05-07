import { IsInt, Min } from 'class-validator';

export class RentDto {
  @IsInt()
  @Min(1)
  durationDays: number;
}
