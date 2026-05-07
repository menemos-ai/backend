import {
  createWalletClient,
  createPublicClient,
  http,
  keccak256,
  encodePacked,
  hexToBytes,
  toHex,
  defineChain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as nacl from 'tweetnacl';
import { encodeUTF8, decodeUTF8, encodeBase64 } from 'tweetnacl-util';
import type {
  MnemosClientConfig,
  MemoryBundle,
  SnapshotResult,
  ListingTerms,
  AutoSnapshotOptions,
  MemoryInfo,
} from './types.js';

// ─── ABI Literals ────────────────────────────────────────────────────────────
// Minimal — only functions actually called from JS.
// Update these when mnemos-contract changes function signatures or events.

const MEMORY_REGISTRY_ABI = [
  {
    name: 'mintRoot',
    type: 'function',
    inputs: [
      { name: 'contentHash', type: 'bytes32' },
      { name: 'storageUri', type: 'string' },
      { name: 'parent', type: 'uint256' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'getMemoryInfo',
    type: 'function',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'contentHash', type: 'bytes32' },
      { name: 'storageUri', type: 'string' },
      { name: 'creator', type: 'address' },
      { name: 'parent', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'MemoryMinted',
    type: 'event',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'contentHash', type: 'bytes32', indexed: false },
      { name: 'storageUri', type: 'string', indexed: false },
    ],
  },
] as const;

const MEMORY_MARKETPLACE_ABI = [
  {
    name: 'list',
    type: 'function',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'price', type: 'uint256' },
      { name: 'rentalPricePerDay', type: 'uint256' },
      { name: 'isForSale', type: 'bool' },
      { name: 'isForRent', type: 'bool' },
      { name: 'isForFork', type: 'bool' },
      { name: 'forkRoyaltyBps', type: 'uint16' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'buy',
    type: 'function',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    name: 'rent',
    type: 'function',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'durationDays', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    name: 'fork',
    type: 'function',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: 'newTokenId', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    name: 'payRoyalty',
    type: 'function',
    inputs: [{ name: 'parentTokenId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    name: 'getListing',
    type: 'function',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'price', type: 'uint256' },
      { name: 'rentalPricePerDay', type: 'uint256' },
      { name: 'isForSale', type: 'bool' },
      { name: 'isForRent', type: 'bool' },
      { name: 'isForFork', type: 'bool' },
      { name: 'forkRoyaltyBps', type: 'uint16' },
      { name: 'seller', type: 'address' },
    ],
    stateMutability: 'view',
  },
] as const;

// ─── Chain Definition ─────────────────────────────────────────────────────────
// Verify chain ID and explorer URL at https://docs.0g.ai/
const ogNewtonTestnet = defineChain({
  id: 16600,
  name: '0G Newton Testnet',
  nativeCurrency: { name: '0G', symbol: 'A0GI', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://evmrpc-testnet.0g.ai'] },
  },
  blockExplorers: {
    default: { name: '0G Explorer', url: 'https://chainscan-newton.0g.ai' },
  },
});

// ─── MnemosClient ─────────────────────────────────────────────────────────────

export class MnemosClient {
  private readonly account: ReturnType<typeof privateKeyToAccount>;
  private readonly walletClient: ReturnType<typeof createWalletClient>;
  private readonly publicClient: ReturnType<typeof createPublicClient>;
  private readonly config: MnemosClientConfig;
  private autoSnapshotTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: MnemosClientConfig) {
    this.config = config;
    this.account = privateKeyToAccount(config.privateKey);

    this.walletClient = createWalletClient({
      account: this.account,
      chain: ogNewtonTestnet,
      transport: http(config.rpcUrl),
    });

    this.publicClient = createPublicClient({
      chain: ogNewtonTestnet,
      transport: http(config.rpcUrl),
    });
  }

  async snapshot(bundle: MemoryBundle, parentTokenId?: bigint): Promise<SnapshotResult> {
    const json = JSON.stringify(bundle);
    const encrypted = this.encrypt(json);

    const storageUri = await this.uploadToStorage(encrypted);
    const contentHash = keccak256(toHex(encrypted));

    const txHash = await this.walletClient.writeContract({
      address: this.config.registryAddress,
      abi: MEMORY_REGISTRY_ABI,
      functionName: 'mintRoot',
      args: [contentHash, storageUri, parentTokenId ?? 0n],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });

    const mintedLog = receipt.logs.find((log) => {
      try {
        return log.topics[0] !== undefined;
      } catch {
        return false;
      }
    });

    const tokenId = mintedLog?.topics[1] ? BigInt(mintedLog.topics[1]) : 0n;

    return {
      tokenId,
      contentHash,
      storageUri,
      txHash,
      timestamp: Date.now(),
    };
  }

  async list(tokenId: bigint, terms: ListingTerms): Promise<`0x${string}`> {
    return this.walletClient.writeContract({
      address: this.config.marketplaceAddress,
      abi: MEMORY_MARKETPLACE_ABI,
      functionName: 'list',
      args: [
        tokenId,
        terms.price,
        terms.rentalPricePerDay,
        terms.isForSale,
        terms.isForRent,
        terms.isForFork,
        terms.forkRoyaltyBps,
      ],
    });
  }

  async buy(tokenId: bigint): Promise<`0x${string}`> {
    const listing = await this.getListing(tokenId);
    return this.walletClient.writeContract({
      address: this.config.marketplaceAddress,
      abi: MEMORY_MARKETPLACE_ABI,
      functionName: 'buy',
      args: [tokenId],
      value: listing.price,
    });
  }

  async rent(tokenId: bigint, durationDays: number): Promise<`0x${string}`> {
    const listing = await this.getListing(tokenId);
    const totalCost = listing.rentalPricePerDay * BigInt(durationDays);
    return this.walletClient.writeContract({
      address: this.config.marketplaceAddress,
      abi: MEMORY_MARKETPLACE_ABI,
      functionName: 'rent',
      args: [tokenId, BigInt(durationDays)],
      value: totalCost,
    });
  }

  async fork(tokenId: bigint): Promise<`0x${string}`> {
    return this.walletClient.writeContract({
      address: this.config.marketplaceAddress,
      abi: MEMORY_MARKETPLACE_ABI,
      functionName: 'fork',
      args: [tokenId],
    });
  }

  async payRoyalty(parentTokenId: bigint, amount: bigint): Promise<`0x${string}`> {
    return this.walletClient.writeContract({
      address: this.config.marketplaceAddress,
      abi: MEMORY_MARKETPLACE_ABI,
      functionName: 'payRoyalty',
      args: [parentTokenId],
      value: amount,
    });
  }

  async getListing(tokenId: bigint): Promise<{
    price: bigint;
    rentalPricePerDay: bigint;
    isForSale: boolean;
    isForRent: boolean;
    isForFork: boolean;
    forkRoyaltyBps: number;
    seller: `0x${string}`;
  }> {
    const result = await this.publicClient.readContract({
      address: this.config.marketplaceAddress,
      abi: MEMORY_MARKETPLACE_ABI,
      functionName: 'getListing',
      args: [tokenId],
    });
    const { price, rentalPricePerDay, isForSale, isForRent, isForFork, forkRoyaltyBps, seller } =
      result as {
        price: bigint;
        rentalPricePerDay: bigint;
        isForSale: boolean;
        isForRent: boolean;
        isForFork: boolean;
        forkRoyaltyBps: number;
        seller: `0x${string}`;
      };
    return { price, rentalPricePerDay, isForSale, isForRent, isForFork, forkRoyaltyBps, seller };
  }

  async getMemoryInfo(tokenId: bigint): Promise<MemoryInfo> {
    const result = await this.publicClient.readContract({
      address: this.config.registryAddress,
      abi: MEMORY_REGISTRY_ABI,
      functionName: 'getMemoryInfo',
      args: [tokenId],
    });
    const { contentHash, storageUri, creator, parent, timestamp } = result as {
      contentHash: `0x${string}`;
      storageUri: string;
      creator: `0x${string}`;
      parent: bigint;
      timestamp: bigint;
    };
    return { tokenId, contentHash, storageUri, creator, parent, timestamp };
  }

  async loadMemory(tokenId: bigint): Promise<MemoryBundle> {
    const info = await this.getMemoryInfo(tokenId);
    const encrypted = await this.downloadFromStorage(info.storageUri);
    const decrypted = this.decrypt(encrypted);
    return JSON.parse(decrypted) as MemoryBundle;
  }

  autoSnapshot(options: AutoSnapshotOptions): () => void {
    this.autoSnapshotTimer = setInterval(async () => {
      try {
        const bundle = await options.buildBundle();
        const result = await this.snapshot(bundle);
        options.onSnapshot?.(result);
      } catch (error) {
        options.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    }, options.intervalMs);

    return () => {
      if (this.autoSnapshotTimer) {
        clearInterval(this.autoSnapshotTimer);
        this.autoSnapshotTimer = null;
      }
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private encrypt(data: string): Uint8Array {
    const key = this.deriveSymmetricKey();
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const message = encodeUTF8(data);
    const box = nacl.secretbox(message, nonce, key);
    const result = new Uint8Array(nonce.length + box.length);
    result.set(nonce);
    result.set(box, nonce.length);
    return result;
  }

  private decrypt(data: Uint8Array): string {
    const key = this.deriveSymmetricKey();
    const nonce = data.slice(0, nacl.secretbox.nonceLength);
    const box = data.slice(nacl.secretbox.nonceLength);
    const decrypted = nacl.secretbox.open(box, nonce, key);
    if (!decrypted) throw new Error('Decryption failed — invalid key or corrupted data');
    return decodeUTF8(decrypted);
  }

  private deriveSymmetricKey(): Uint8Array {
    const hash = keccak256(encodePacked(['address'], [this.account.address]));
    // WARNING: deterministic key — see CLAUDE.md encryption design for v2 plan
    return hexToBytes(hash).slice(0, 32);
  }

  private async uploadToStorage(data: Uint8Array): Promise<string> {
    // TODO: replace with real @0glabs/0g-ts-sdk upload call
    console.warn('[mnemos/sdk] uploadToStorage is stubbed — integrate @0glabs/0g-ts-sdk');
    return `0g://stub/${encodeBase64(data.slice(0, 8))}`;
  }

  private async downloadFromStorage(_uri: string): Promise<Uint8Array> {
    // TODO: replace with real @0glabs/0g-ts-sdk download call
    console.warn('[mnemos/sdk] downloadFromStorage is stubbed — integrate @0glabs/0g-ts-sdk');
    return new Uint8Array();
  }
}
