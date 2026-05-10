export type MemoryCategory = 'trading' | 'research' | 'support' | 'gaming' | 'social' | (string & {});

export interface MemoryMetadata {
  category: MemoryCategory;
  title?: string;
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
  buyPrice: bigint;
  rentPricePerDay: bigint;
  forkPrice: bigint;
  royaltyBps: number;
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
  chainId: number;
  rpcUrl: string;
  storageNodeUrl: string;
  registryAddress: `0x${string}`;
  marketplaceAddress: `0x${string}`;
  /** Skip real 0G Storage upload and use a stub URI — useful for demo/testing */
  storageMock?: boolean;
}

export interface AutoSnapshotOptions {
  intervalMs: number;
  buildBundle: () => MemoryBundle | Promise<MemoryBundle>;
  onSnapshot?: (result: SnapshotResult) => void;
  onError?: (error: Error) => void;
}
