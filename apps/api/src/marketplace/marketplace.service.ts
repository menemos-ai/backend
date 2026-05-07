import { Injectable } from '@nestjs/common';
import { MnemosService } from '../mnemos/mnemos.service';
import type { ListDto } from './dto/list.dto';
import type { RentDto } from './dto/rent.dto';

@Injectable()
export class MarketplaceService {
  constructor(private readonly mnemos: MnemosService) {}

  async getListing(tokenId: bigint) {
    const result = await this.mnemos.getClient().getListing(tokenId);
    return {
      price: result.price.toString(),
      rentalPricePerDay: result.rentalPricePerDay.toString(),
      isForSale: result.isForSale,
      isForRent: result.isForRent,
      isForFork: result.isForFork,
      forkRoyaltyBps: result.forkRoyaltyBps,
      seller: result.seller,
    };
  }

  async list(dto: ListDto) {
    const txHash = await this.mnemos.getClient().list(BigInt(dto.tokenId), {
      price: BigInt(dto.price),
      rentalPricePerDay: BigInt(dto.rentalPricePerDay),
      isForSale: dto.isForSale,
      isForRent: dto.isForRent,
      isForFork: dto.isForFork,
      forkRoyaltyBps: dto.forkRoyaltyBps,
    });
    return { txHash };
  }

  async buy(tokenId: bigint) {
    const txHash = await this.mnemos.getClient().buy(tokenId);
    return { txHash };
  }

  async rent(tokenId: bigint, dto: RentDto) {
    const txHash = await this.mnemos.getClient().rent(tokenId, dto.durationDays);
    return { txHash };
  }

  async fork(tokenId: bigint) {
    const txHash = await this.mnemos.getClient().fork(tokenId);
    return { txHash };
  }
}
