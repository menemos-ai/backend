import { Inject, Injectable } from '@nestjs/common';
import { handleChainError } from '../common/chain-error.util';
import { MARKETPLACE_REPOSITORY, IMarketplaceRepository } from './marketplace.repository.interface';
import type { ListDto } from './dto/list.dto';
import type { RentDto } from './dto/rent.dto';

@Injectable()
export class MarketplaceService {
  constructor(
    @Inject(MARKETPLACE_REPOSITORY) private readonly repo: IMarketplaceRepository,
  ) {}

  async getListing(tokenId: bigint) {
    try {
      const result = await this.repo.getListing(tokenId);
      return {
        price: result.price.toString(),
        rentalPricePerDay: result.rentalPricePerDay.toString(),
        isForSale: result.isForSale,
        isForRent: result.isForRent,
        isForFork: result.isForFork,
        forkRoyaltyBps: result.forkRoyaltyBps,
        seller: result.seller,
      };
    } catch (error) {
      handleChainError(error);
    }
  }

  async list(dto: ListDto) {
    try {
      const txHash = await this.repo.list(BigInt(dto.tokenId), {
        price: BigInt(dto.price),
        rentalPricePerDay: BigInt(dto.rentalPricePerDay),
        isForSale: dto.isForSale,
        isForRent: dto.isForRent,
        isForFork: dto.isForFork,
        forkRoyaltyBps: dto.forkRoyaltyBps,
      });
      return { txHash };
    } catch (error) {
      handleChainError(error);
    }
  }

  async buy(tokenId: bigint) {
    try {
      const txHash = await this.repo.buy(tokenId);
      return { txHash };
    } catch (error) {
      handleChainError(error);
    }
  }

  async rent(tokenId: bigint, dto: RentDto) {
    try {
      const txHash = await this.repo.rent(tokenId, dto.durationDays);
      return { txHash };
    } catch (error) {
      handleChainError(error);
    }
  }

  async fork(tokenId: bigint) {
    try {
      const txHash = await this.repo.fork(tokenId);
      return { txHash };
    } catch (error) {
      handleChainError(error);
    }
  }

}
