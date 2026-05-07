import type { ListingTerms, SnapshotResult, MemoryBundle, MemoryInfo } from '@mnemos/sdk';

export const MARKETPLACE_REPOSITORY = Symbol('IMarketplaceRepository');

export interface IMarketplaceRepository {
  getListing(tokenId: bigint): Promise<{
    seller: `0x${string}`;
    buyPrice: bigint;
    rentPricePerDay: bigint;
    forkPrice: bigint;
    royaltyBps: number;
  }>;

  list(tokenId: bigint, terms: ListingTerms): Promise<`0x${string}`>;

  buy(tokenId: bigint): Promise<`0x${string}`>;

  rent(tokenId: bigint, durationDays: number): Promise<`0x${string}`>;

  fork(tokenId: bigint): Promise<`0x${string}`>;

  payRoyalty(parentTokenId: bigint, amount: bigint): Promise<`0x${string}`>;
}
