import { IsString } from 'class-validator';

export class PayRoyaltyDto {
  @IsString()
  amount!: string;
}
