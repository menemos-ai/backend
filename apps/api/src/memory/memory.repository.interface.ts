import type { MemoryBundle, MemoryInfo, SnapshotResult } from '@mnemos-sdk/sdk';

export const MEMORY_REPOSITORY = Symbol('IMemoryRepository');

export interface IMemoryRepository {
  snapshot(bundle: MemoryBundle, parentTokenId?: bigint): Promise<SnapshotResult>;

  getMemoryInfo(tokenId: bigint): Promise<MemoryInfo>;

  loadMemory(tokenId: bigint): Promise<MemoryBundle>;
}
