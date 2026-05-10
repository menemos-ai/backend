import {
  createWalletClient,
  createPublicClient,
  http,
  keccak256,
  encodePacked,
  hexToBytes,
  toHex,
  defineChain,
  getAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as nacl from 'tweetnacl';
import { encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
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
    name: 'mintMemory',
    type: 'function',
    inputs: [
      { name: 'contentHash', type: 'bytes32' },
      { name: 'storageURI', type: 'string' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    // Returns MemorySnapshot struct encoded as a single dynamic tuple.
    // Must use type:'tuple' so viem reads the outer offset pointer Solidity adds
    // for structs with dynamic members (string) before the struct data.
    name: 'getSnapshot',
    type: 'function',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'contentHash', type: 'bytes32' },
          { name: 'storageURI', type: 'string' },
          { name: 'parentTokenId', type: 'uint256' },
          { name: 'creator', type: 'address' },
          { name: 'createdAt', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    // ERC-721 ownerOf — reverts if token does not exist
    name: 'ownerOf',
    type: 'function',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: 'owner', type: 'address' }],
    stateMutability: 'view',
  },
  {
    name: 'MemoryMinted',
    type: 'event',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'contentHash', type: 'bytes32', indexed: false },
      { name: 'storageURI', type: 'string', indexed: false },
    ],
  },
] as const;

const MEMORY_MARKETPLACE_ABI = [
  {
    name: 'list',
    type: 'function',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'buyPrice', type: 'uint256' },
      { name: 'rentPricePerDay', type: 'uint256' },
      { name: 'forkPrice', type: 'uint256' },
      { name: 'royaltyBps', type: 'uint96' },
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
    inputs: [
      { name: 'parentTokenId', type: 'uint256' },
      { name: 'contentHash', type: 'bytes32' },
      { name: 'storageURI', type: 'string' },
    ],
    outputs: [{ name: 'childTokenId', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    name: 'payRoyalty',
    type: 'function',
    inputs: [{ name: 'childTokenId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    name: 'getListing',
    type: 'function',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'seller', type: 'address' },
      { name: 'buyPrice', type: 'uint256' },
      { name: 'rentPricePerDay', type: 'uint256' },
      { name: 'forkPrice', type: 'uint256' },
      { name: 'royaltyBps', type: 'uint96' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'isCurrentRenter',
    type: 'function',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'renter', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

// ─── URI scheme ───────────────────────────────────────────────────────────────
// v1: 0g://<rootHash>        — key derived from producer wallet (legacy, unreadable by consumers)
// v2: v2:0g://<rootHash>     — key derived from plaintext contentHash (readable by consumers)

const V2_PREFIX = 'v2:';

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

    const chain = defineChain({
      id: config.chainId,
      name: '0G Network',
      nativeCurrency: { name: '0G', symbol: 'A0GI', decimals: 18 },
      rpcUrls: { default: { http: [config.rpcUrl] } },
    });

    this.walletClient = createWalletClient({
      account: this.account,
      chain,
      transport: http(config.rpcUrl),
    });

    this.publicClient = createPublicClient({
      chain,
      transport: http(config.rpcUrl),
    });
  }

  async snapshot(bundle: MemoryBundle, parentTokenId?: bigint): Promise<SnapshotResult> {
    const json = JSON.stringify(bundle);

    // v2 key scheme: contentHash = keccak256(plaintext) — used as both the
    // on-chain content identifier AND the symmetric encryption key seed.
    // This lets any holder of tokenId derive the key from the public on-chain data.
    const contentHash = keccak256(toHex(decodeUTF8(json)));
    const key = this.deriveContentKey(contentHash);
    const encrypted = this.encrypt(json, key);

    const storageUri = await this.uploadToStorage(encrypted);
    const versionedUri = `${V2_PREFIX}${storageUri}`;

    const txHash = await (this.walletClient as any).writeContract({
      address: this.config.registryAddress,
      abi: MEMORY_REGISTRY_ABI,
      functionName: 'mintMemory',
      args: [contentHash, versionedUri],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 120_000,
      pollingInterval: 3_000,
    });

    // MemoryMinted(uint256 indexed tokenId, address indexed creator, bytes32, string)
    const MEMORY_MINTED_TOPIC = '0x6a94f063b9e2ac347622f0dcce749dbbf6232caf048066debb3f06ae77504bd9';
    const mintedLog = receipt.logs.find((log) => log.topics[0] === MEMORY_MINTED_TOPIC);

    const tokenId = mintedLog?.topics[1] ? BigInt(mintedLog.topics[1]) : 0n;

    return {
      tokenId,
      contentHash,
      storageUri: versionedUri,
      txHash,
      timestamp: Date.now(),
    };
  }

  async list(tokenId: bigint, terms: ListingTerms): Promise<`0x${string}`> {
    return (this.walletClient as any).writeContract({
      address: this.config.marketplaceAddress,
      abi: MEMORY_MARKETPLACE_ABI,
      functionName: 'list',
      args: [tokenId, terms.buyPrice, terms.rentPricePerDay, terms.forkPrice, BigInt(terms.royaltyBps)],
    });
  }

  async buy(tokenId: bigint): Promise<`0x${string}`> {
    const listing = await this.getListing(tokenId);
    return (this.walletClient as any).writeContract({
      address: this.config.marketplaceAddress,
      abi: MEMORY_MARKETPLACE_ABI,
      functionName: 'buy',
      args: [tokenId],
      value: listing.buyPrice,
    });
  }

  async rent(tokenId: bigint, durationDays: number): Promise<`0x${string}`> {
    const listing = await this.getListing(tokenId);
    const totalCost = listing.rentPricePerDay * BigInt(durationDays);
    return (this.walletClient as any).writeContract({
      address: this.config.marketplaceAddress,
      abi: MEMORY_MARKETPLACE_ABI,
      functionName: 'rent',
      args: [tokenId, BigInt(durationDays)],
      value: totalCost,
    });
  }

  async fork(
    parentTokenId: bigint,
    contentHash: `0x${string}`,
    storageURI: string,
    value: bigint,
  ): Promise<`0x${string}`> {
    return (this.walletClient as any).writeContract({
      address: this.config.marketplaceAddress,
      abi: MEMORY_MARKETPLACE_ABI,
      functionName: 'fork',
      args: [parentTokenId, contentHash, storageURI],
      value,
    });
  }

  async payRoyalty(parentTokenId: bigint, amount: bigint): Promise<`0x${string}`> {
    return (this.walletClient as any).writeContract({
      address: this.config.marketplaceAddress,
      abi: MEMORY_MARKETPLACE_ABI,
      functionName: 'payRoyalty',
      args: [parentTokenId],
      value: amount,
    });
  }

  async getListing(tokenId: bigint): Promise<{
    seller: `0x${string}`;
    buyPrice: bigint;
    rentPricePerDay: bigint;
    forkPrice: bigint;
    royaltyBps: number;
  }> {
    const result = await this.publicClient.readContract({
      address: this.config.marketplaceAddress,
      abi: MEMORY_MARKETPLACE_ABI,
      functionName: 'getListing',
      args: [tokenId],
    });
    const [seller, buyPrice, rentPricePerDay, forkPrice, royaltyBps] =
      result as unknown as [`0x${string}`, bigint, bigint, bigint, number];
    return { seller, buyPrice, rentPricePerDay, forkPrice, royaltyBps };
  }

  async getMemoryInfo(tokenId: bigint): Promise<MemoryInfo> {
    const result = await this.publicClient.readContract({
      address: this.config.registryAddress,
      abi: MEMORY_REGISTRY_ABI,
      functionName: 'getSnapshot',
      args: [tokenId],
    });
    // viem returns a named-field object for tuple outputs
    const snap = result as unknown as {
      contentHash: `0x${string}`;
      storageURI: string;
      parentTokenId: bigint;
      creator: `0x${string}`;
      createdAt: bigint;
    };
    return {
      tokenId,
      contentHash: snap.contentHash,
      storageUri: snap.storageURI,
      creator: snap.creator,
      parent: snap.parentTokenId,
      timestamp: snap.createdAt,
    };
  }

  async loadMemory(tokenId: bigint): Promise<MemoryBundle> {
    const info = await this.getMemoryInfo(tokenId);
    const encrypted = await this.downloadFromStorage(info.storageUri);

    // v2 tokens: key derived from the on-chain contentHash (keccak256 of plaintext)
    // v1 tokens: key derived from the producer's wallet address — unreadable by consumers
    if (info.storageUri.startsWith(V2_PREFIX)) {
      const key = this.deriveContentKey(info.contentHash);
      const decrypted = this.decrypt(encrypted, key);
      return JSON.parse(decrypted) as MemoryBundle;
    }

    // v1 fallback: decrypt with the server-side wallet key (only works for the producer)
    const key = this.deriveWalletKey();
    const decrypted = this.decrypt(encrypted, key);
    return JSON.parse(decrypted) as MemoryBundle;
  }

  /**
   * Returns true if callerAddress currently has access to tokenId via buy or rent.
   * Uses Promise.allSettled so that ownerOf revert (non-existent token) is treated
   * as "not owner" rather than an unhandled rejection.
   */
  async hasAccess(tokenId: bigint, callerAddress: `0x${string}`): Promise<boolean> {
    const normalizedCaller = getAddress(callerAddress);

    const [ownerResult, renterResult] = await Promise.allSettled([
      this.publicClient.readContract({
        address: this.config.registryAddress,
        abi: MEMORY_REGISTRY_ABI,
        functionName: 'ownerOf',
        args: [tokenId],
      }),
      this.publicClient.readContract({
        address: this.config.marketplaceAddress,
        abi: MEMORY_MARKETPLACE_ABI,
        functionName: 'isCurrentRenter',
        args: [tokenId, normalizedCaller],
      }),
    ]);

    let isOwner = false;
    if (ownerResult.status === 'fulfilled') {
      try {
        isOwner = getAddress(ownerResult.value as `0x${string}`) === normalizedCaller;
      } catch {
        // ABI mismatch or non-address return value — treat as not owner
      }
    }

    const isRenter =
      renterResult.status === 'fulfilled' && renterResult.value === true;

    return isOwner || isRenter;
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

  private encrypt(data: string, key: Uint8Array): Uint8Array {
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    // decodeUTF8: string → Uint8Array (tweetnacl-util naming is inverted vs intuition)
    const message = decodeUTF8(data);
    const box = nacl.secretbox(message, nonce, key);
    const result = new Uint8Array(nonce.length + box.length);
    result.set(nonce);
    result.set(box, nonce.length);
    return result;
  }

  private decrypt(data: Uint8Array, key: Uint8Array): string {
    const nonce = data.slice(0, nacl.secretbox.nonceLength);
    const box = data.slice(nacl.secretbox.nonceLength);
    const decrypted = nacl.secretbox.open(box, nonce, key);
    if (!decrypted) throw new Error('Decryption failed — invalid key or corrupted data');
    // encodeUTF8: Uint8Array → string (tweetnacl-util naming is inverted vs intuition)
    return encodeUTF8(decrypted);
  }

  // v2 key: first 32 bytes of keccak256(plaintext) = the on-chain contentHash.
  // DESIGN NOTE: This provides API-enforced access only, NOT cryptographic enforcement.
  // Anyone with direct chain + 0G Storage access can derive the key from the public
  // contentHash without going through the API. Production upgrade: TEE/threshold key
  // escrow so the key is released atomically with on-chain payment settlement.
  private deriveContentKey(contentHash: `0x${string}`): Uint8Array {
    return hexToBytes(contentHash).slice(0, 32);
  }

  // v1 key: derived from this client's wallet address. Only the producer can decrypt.
  private deriveWalletKey(): Uint8Array {
    const hash = keccak256(encodePacked(['address'], [this.account.address]));
    return hexToBytes(hash).slice(0, 32);
  }

  // ─── 0G Storage ─────────────────────────────────────────────────────────────

  private async uploadToStorage(data: Uint8Array): Promise<string> {
    const { Indexer, MemData } = await import('@0gfoundation/0g-ts-sdk');

    // The 0g-ts-sdk requires an ethers-shaped Signer. We satisfy that interface
    // with a thin adapter that delegates all blockchain calls to viem so no
    // separate ethers dependency is needed in this package.
    const signer = this.createViemSignerAdapter();
    const indexer = new Indexer(this.config.storageNodeUrl);
    const file = new MemData(data);

    const [result, err] = await indexer.upload(
      file,
      this.config.rpcUrl,
      signer as any, // duck-typed — satisfies ContractRunner at runtime
    );
    if (err !== null) {
      throw new Error(`0G Storage upload failed: ${err.message}`);
    }

    const rootHash = 'rootHash' in result ? result.rootHash : result.rootHashes[0];
    return `0g://${rootHash}`;
  }

  private async downloadFromStorage(uri: string): Promise<Uint8Array> {
    const { Indexer } = await import('@0gfoundation/0g-ts-sdk');
    const { tmpdir } = await import('os');
    const { readFile, unlink } = await import('fs/promises');

    // Strip versioning prefix before passing the raw URI to the storage layer
    const rawUri = uri.startsWith(V2_PREFIX) ? uri.slice(V2_PREFIX.length) : uri;

    // 0g-ts-sdk v0.3.3 writes to a file path; no in-memory download API exists.
    const rootHash = rawUri.startsWith('0g://') ? rawUri.slice(5) : rawUri;
    const { randomBytes } = await import('crypto');
    const tmpPath = `${tmpdir()}/mnemos-${Date.now()}-${randomBytes(4).toString('hex')}-${rootHash.slice(0, 8)}`;

    const indexer = new Indexer(this.config.storageNodeUrl);
    const err = await indexer.download(rootHash, tmpPath, false);
    if (err !== null) {
      throw new Error(`0G Storage download failed: ${err.message}`);
    }

    try {
      const bytes = await readFile(tmpPath);
      return new Uint8Array(bytes);
    } finally {
      await unlink(tmpPath).catch(() => {}); // best-effort cleanup
    }
  }

  // ─── Viem → ethers signer adapter ────────────────────────────────────────
  // The 0g-ts-sdk's Indexer.upload() requires an ethers ContractRunner/Signer.
  // This adapter wraps viem's walletClient and publicClient to satisfy that
  // interface without adding ethers as an explicit dependency.
  //
  // What the flow contract actually calls on our adapter:
  //   - provider.call(tx)          ← for flow.market() read call
  //   - provider.getNetwork()      ← ethers uses chainId for EIP-155 signing
  //   - provider.getTransactionCount(addr) ← nonce resolution
  //   - sendTransaction(tx)        ← for flow.submit() write call
  //
  // Everything else (getFeeData, getTransactionReceipt) goes through the
  // Uploader's own internal ethers JsonRpcProvider, not our adapter.
  private createViemSignerAdapter() {
    const walletClient = this.walletClient;
    const publicClient = this.publicClient;
    const account = this.account;

    const provider = {
      async call(tx: { to?: string; data?: string }) {
        const result = await publicClient.call({
          to: tx.to as `0x${string}` | undefined,
          data: tx.data as `0x${string}` | undefined,
        });
        return result.data ?? '0x';
      },

      async getNetwork() {
        const chainId = await publicClient.getChainId();
        return { chainId: BigInt(chainId) };
      },

      async getTransactionCount(address: string) {
        return publicClient.getTransactionCount({
          address: address as `0x${string}`,
        });
      },

      async estimateGas(tx: { to?: string; data?: string; value?: bigint }) {
        return publicClient.estimateGas({
          to: tx.to as `0x${string}`,
          data: tx.data as `0x${string}`,
          value: tx.value,
          account: account.address,
        });
      },
    };

    const toBI = (v: unknown): bigint | undefined =>
      v != null ? BigInt(v.toString()) : undefined;

    return {
      provider,

      async getAddress() {
        return account.address;
      },

      async sendTransaction(tx: {
        to?: string;
        data?: string;
        value?: unknown;
        gasLimit?: unknown;
        gasPrice?: unknown;
        nonce?: number;
      }) {
        const hash = await (walletClient as any).sendTransaction({
          to: tx.to as `0x${string}` | undefined,
          data: tx.data as `0x${string}` | undefined,
          value: toBI(tx.value),
          gas: toBI(tx.gasLimit),
          gasPrice: toBI(tx.gasPrice),
          nonce: tx.nonce,
        });

        return {
          hash,
          wait: async () => {
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            return {
              hash,
              status: receipt.status === 'success' ? 1 : 0,
              logs: receipt.logs,
            };
          },
        };
      },

      async call(tx: { to?: string; data?: string }) {
        return provider.call(tx);
      },

      connect() {
        return this;
      },
    };
  }
}
