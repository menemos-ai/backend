import { Injectable } from '@nestjs/common';
import { MnemosService } from '../mnemos/mnemos.service';
import type { ListingTerms } from '@mnemos/sdk';
import type { IMarketplaceRepository } from './marketplace.repository.interface';

@Injectable()
export class MarketplaceRepository implements IMarketplaceRepository {
  constructor(private readonly mnemos: MnemosService) {}

  getListing(tokenId: bigint) {
    return this.mnemos.getClient().getListing(tokenId);
  }

  list(tokenId: bigint, terms: ListingTerms) {
    return this.mnemos.getClient().list(tokenId, terms);
  }

  buy(tokenId: bigint) {
    return this.mnemos.getClient().buy(tokenId);
  }

  rent(tokenId: bigint, durationDays: number) {
    return this.mnemos.getClient().rent(tokenId, durationDays);
  }

  fork(tokenId: bigint) {
    return this.mnemos.getClient().fork(tokenId);
  }

  payRoyalty(parentTokenId: bigint, amount: bigint) {
    return this.mnemos.getClient().payRoyalty(parentTokenId, amount);
  }
}
