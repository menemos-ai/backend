import { IsBoolean, IsNumber, IsString, Max, Min } from 'class-validator';

export class ListDto {
  @IsString()
  tokenId!: string;

  @IsString()
  price!: string;

  @IsString()
  rentalPricePerDay!: string;

  @IsBoolean()
  isForSale!: boolean;

  @IsBoolean()
  isForRent!: boolean;

  @IsBoolean()
  isForFork!: boolean;

  @IsNumber()
  @Min(0)
  @Max(10000)
  forkRoyaltyBps!: number;
}
