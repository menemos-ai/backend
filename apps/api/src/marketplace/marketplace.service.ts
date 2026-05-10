import { Inject, Injectable } from '@nestjs/common';
import { handleChainError } from '../common/chain-error.util';
import { MARKETPLACE_REPOSITORY, IMarketplaceRepository } from './marketplace.repository.interface';
import type { ListDto } from './dto/list.dto';
import type { RentDto } from './dto/rent.dto';
import type { PayRoyaltyDto } from './dto/pay-royalty.dto';

@Injectable()
export class MarketplaceService {
  constructor(
    @Inject(MARKETPLACE_REPOSITORY) private readonly repo: IMarketplaceRepository,
  ) {}

  async getListing(tokenId: bigint) {
    try {
      const result = await this.repo.getListing(tokenId);
      return {
        seller: result.seller,
        buyPrice: result.buyPrice.toString(),
        rentPricePerDay: result.rentPricePerDay.toString(),
        forkPrice: result.forkPrice.toString(),
        royaltyBps: Number(result.royaltyBps),
      };
    } catch (error) {
      handleChainError(error);
    }
  }

  async list(dto: ListDto) {
    try {
      const txHash = await this.repo.list(BigInt(dto.tokenId), {
        buyPrice: BigInt(dto.price),
        rentPricePerDay: BigInt(dto.rentalPricePerDay),
        forkPrice: BigInt(dto.forkPrice),
        royaltyBps: dto.forkRoyaltyBps,
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

  async payRoyalty(tokenId: bigint, dto: PayRoyaltyDto) {
    try {
      const txHash = await this.repo.payRoyalty(tokenId, BigInt(dto.amount));
      return { txHash };
    } catch (error) {
      handleChainError(error);
    }
  }
}
