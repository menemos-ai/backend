export type MemoryCategory = 'trading' | 'research' | 'support' | 'gaming' | 'social' | (string & {});

export interface MemoryMetadata {
  category: MemoryCategory;
  agentId?: string;
  version?: string;
  createdAt?: number;
  tags?: string[];
}

export interface MemoryBundle {
  data: unknown;
  metadata: MemoryMetadata;
}

export interface ListingTerms {
  price: bigint;
  rentalPricePerDay: bigint;
  isForSale: boolean;
  isForRent: boolean;
  isForFork: boolean;
  forkRoyaltyBps: number;
}

export interface SnapshotResult {
  tokenId: bigint;
  contentHash: `0x${string}`;
  storageUri: string;
  txHash: `0x${string}`;
  timestamp: number;
}

export interface MemoryInfo {
  tokenId: bigint;
  contentHash: `0x${string}`;
  storageUri: string;
  creator: `0x${string}`;
  parent: bigint;
  timestamp: bigint;
}

export interface MnemosClientConfig {
  privateKey: `0x${string}`;
  rpcUrl: string;
  storageNodeUrl: string;
  registryAddress: `0x${string}`;
  marketplaceAddress: `0x${string}`;
}

export interface AutoSnapshotOptions {
  intervalMs: number;
  buildBundle: () => MemoryBundle | Promise<MemoryBundle>;
  onSnapshot?: (result: SnapshotResult) => void;
  onError?: (error: Error) => void;
}
