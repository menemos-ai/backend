import { IsBoolean, IsNumber, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ListDto {
  @ApiProperty({ description: 'Token ID of the memory NFT to list', example: '1' })
  @IsString()
  tokenId!: string;

  @ApiProperty({
    description: 'Sale price in wei (EVM uint256 as decimal string)',
    example: '1000000000000000000',
  })
  @IsString()
  price!: string;

  @ApiProperty({
    description: 'Rental price per day in wei (EVM uint256 as decimal string)',
    example: '100000000000000000',
  })
  @IsString()
  rentalPricePerDay!: string;

  @ApiProperty({
    description: 'Fork price in wei (EVM uint256 as decimal string). Set to "0" to disable forking.',
    example: '500000000000000000',
  })
  @IsString()
  forkPrice!: string;

  @ApiProperty({
    description: 'Royalty fee in basis points (0–10 000). 500 = 5%',
    example: 500,
    minimum: 0,
    maximum: 10000,
  })
  @IsNumber()
  @Min(0)
  @Max(10000)
  forkRoyaltyBps!: number;
}
