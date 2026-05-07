import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RentDto {
  @ApiProperty({ description: 'Rental duration in days', example: 7, minimum: 1 })
  @IsInt()
  @Min(1)
  durationDays!: number;
}
