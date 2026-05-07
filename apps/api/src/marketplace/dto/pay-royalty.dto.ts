import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PayRoyaltyDto {
  @ApiProperty({
    description: 'Royalty payment amount in wei (EVM uint256 as decimal string)',
    example: '500000000000000000',
  })
  @IsString()
  amount!: string;
}
