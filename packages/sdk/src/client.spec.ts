import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MnemosClient } from './client.js';
import type { MemoryBundle, ListingTerms, SnapshotResult } from './types.js';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
// vi.hoisted runs before vi.mock factories, so these are safely accessible inside them.

const mocks = vi.hoisted(() => ({
  writeContract: vi.fn<[], `0x${string}`>().mockResolvedValue('0xtxhash'),
  readContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  accountAddress: '0xdeadbeef00000000000000000000000000000001' as `0x${string}`,
  indexerUpload: vi.fn().mockResolvedValue([{ rootHash: 'abc123' }, null]),
  indexerDownload: vi.fn().mockResolvedValue(null),
}));

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  return {
    ...actual,
    http: vi.fn(() => ({ type: 'http' })),
    createWalletClient: vi.fn(() => ({ writeContract: mocks.writeContract })),
    createPublicClient: vi.fn(() => ({
      readContract: mocks.readContract,
      waitForTransactionReceipt: mocks.waitForTransactionReceipt,
    })),
  };
});

vi.mock('viem/accounts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem/accounts')>();
  return {
    ...actual,
    privateKeyToAccount: vi.fn(() => ({ address: mocks.accountAddress })),
  };
});

// Prevent @0gfoundation/0g-ts-sdk (which bundles axios) from loading in tests.
// Axios contains non-serializable functions that crash vitest's worker-thread IPC.
vi.mock('@0gfoundation/0g-ts-sdk', () => ({
  Indexer: vi.fn(() => ({
    upload: mocks.indexerUpload,
    download: mocks.indexerDownload,
  })),
  MemData: vi.fn(() => ({})),
}));

// ─── Test fixtures ────────────────────────────────────────────────────────────

const TEST_CONFIG = {
  privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`,
  chainId: 0,
  rpcUrl: 'http://localhost:8545',
  storageNodeUrl: 'http://localhost:5678',
  registryAddress: '0x1234000000000000000000000000000000000001' as `0x${string}`,
  marketplaceAddress: '0x5678000000000000000000000000000000000001' as `0x${string}`,
};

const MOCK_BUNDLE: MemoryBundle = {
  data: { event: 'trade', pair: 'ETH/USDC', amount: 1.5 },
  metadata: { category: 'trading' },
};

// getListing ABI returns: [seller, buyPrice, rentPricePerDay, forkPrice, royaltyBps]
const MOCK_LISTING_RESULT = [
  '0xseller00000000000000000000000000000001' as `0x${string}`, // seller
  1000n, // buyPrice
  100n,  // rentPricePerDay
  500n,  // forkPrice
  500,   // royaltyBps
] as const;

// getSnapshot ABI returns: [contentHash, storageURI, parentTokenId, creator, createdAt]
const MOCK_MEMORY_INFO_RESULT = [
  '0xhash00000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
  '0g://stub/abc123',
  0n,    // parentTokenId → parent in MemoryInfo
  '0xcreator0000000000000000000000000000001' as `0x${string}`,
  1234567890n, // createdAt → timestamp in MemoryInfo
] as const;

// Must match MEMORY_MINTED_TOPIC in client.ts
const MEMORY_MINTED_TOPIC = '0x6a94f063b9e2ac347622f0dcce749dbbf6232caf048066debb3f06ae77504bd9';

function makeReceiptWithTokenId(tokenId: bigint) {
  const hex = `0x${tokenId.toString(16).padStart(64, '0')}` as `0x${string}`;
  return {
    logs: [
      {
        topics: [
          MEMORY_MINTED_TOPIC as `0x${string}`,
          hex, // tokenId as indexed arg
        ],
      },
    ],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MnemosClient', () => {
  let client: MnemosClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.writeContract.mockResolvedValue('0xtxhash' as `0x${string}`);
    mocks.indexerUpload.mockResolvedValue([{ rootHash: 'abc123' }, null]);
    mocks.indexerDownload.mockResolvedValue(null);
    client = new MnemosClient(TEST_CONFIG);
  });

  describe('snapshot()', () => {
    beforeEach(() => {
      mocks.waitForTransactionReceipt.mockResolvedValue(makeReceiptWithTokenId(42n));
    });

    it('calls writeContract with mintMemory and returns SnapshotResult', async () => {
      const result = await client.snapshot(MOCK_BUNDLE);

      expect(mocks.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: TEST_CONFIG.registryAddress,
          functionName: 'mintMemory',
          args: expect.arrayContaining([expect.any(String), expect.any(String)]),
        }),
      );
      expect(result).toMatchObject({
        tokenId: 42n,
        txHash: '0xtxhash',
        storageUri: expect.stringContaining('0g://'),
        contentHash: expect.stringMatching(/^0x/),
        timestamp: expect.any(Number),
      });
    });

    it('extracts tokenId from receipt log topic', async () => {
      mocks.waitForTransactionReceipt.mockResolvedValue(makeReceiptWithTokenId(99n));
      const result = await client.snapshot(MOCK_BUNDLE);
      expect(result.tokenId).toBe(99n);
    });

    it('returns 0n tokenId when receipt has no logs', async () => {
      mocks.waitForTransactionReceipt.mockResolvedValue({ logs: [] });
      const result = await client.snapshot(MOCK_BUNDLE);
      expect(result.tokenId).toBe(0n);
    });
  });

  describe('list()', () => {
    it('calls writeContract with all listing terms', async () => {
      const terms: ListingTerms = {
        buyPrice: 1000n,
        rentPricePerDay: 100n,
        forkPrice: 500n,
        royaltyBps: 500,
      };

      const txHash = await client.list(1n, terms);

      expect(mocks.writeContract).toHaveBeenCalledWith({
        address: TEST_CONFIG.marketplaceAddress,
        abi: expect.any(Array),
        functionName: 'list',
        args: [1n, 1000n, 100n, 500n, 500n],
      });
      expect(txHash).toBe('0xtxhash');
    });
  });

  describe('buy()', () => {
    it('fetches listing buyPrice and passes it as value', async () => {
      mocks.readContract.mockResolvedValue(MOCK_LISTING_RESULT);

      await client.buy(5n);

      expect(mocks.readContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: 'getListing', args: [5n] }),
      );
      expect(mocks.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'buy',
          args: [5n],
          value: 1000n, // listing.buyPrice
        }),
      );
    });
  });

  describe('rent()', () => {
    it('calculates total cost and passes correct args', async () => {
      mocks.readContract.mockResolvedValue(MOCK_LISTING_RESULT);

      await client.rent(3n, 7);

      expect(mocks.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'rent',
          args: [3n, 7n],
          value: 700n, // rentPricePerDay(100n) * durationDays(7)
        }),
      );
    });
  });

  describe('fork()', () => {
    it('calls writeContract with all fork args', async () => {
      const contentHash = '0xfork0000000000000000000000000000000000000000000000000000000001' as `0x${string}`;
      const txHash = await client.fork(9n, contentHash, '0g://storage/uri', 500n);

      expect(mocks.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'fork',
          args: [9n, contentHash, '0g://storage/uri'],
          value: 500n,
        }),
      );
      expect(txHash).toBe('0xtxhash');
    });
  });

  describe('payRoyalty()', () => {
    it('calls writeContract with parentTokenId and amount as value', async () => {
      const txHash = await client.payRoyalty(2n, 500000000000000000n);

      expect(mocks.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'payRoyalty',
          args: [2n],
          value: 500000000000000000n,
        }),
      );
      expect(txHash).toBe('0xtxhash');
    });
  });

  describe('getListing()', () => {
    it('parses tuple result into named fields', async () => {
      mocks.readContract.mockResolvedValue(MOCK_LISTING_RESULT);

      const listing = await client.getListing(1n);

      expect(listing).toEqual({
        seller: '0xseller00000000000000000000000000000001',
        buyPrice: 1000n,
        rentPricePerDay: 100n,
        forkPrice: 500n,
        royaltyBps: 500,
      });
    });

    it('calls readContract with correct address and tokenId', async () => {
      mocks.readContract.mockResolvedValue(MOCK_LISTING_RESULT);

      await client.getListing(42n);

      expect(mocks.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: TEST_CONFIG.marketplaceAddress,
          functionName: 'getListing',
          args: [42n],
        }),
      );
    });
  });

  describe('getMemoryInfo()', () => {
    it('parses tuple result into MemoryInfo', async () => {
      mocks.readContract.mockResolvedValue(MOCK_MEMORY_INFO_RESULT);

      const info = await client.getMemoryInfo(7n);

      expect(info).toEqual({
        tokenId: 7n,
        contentHash: MOCK_MEMORY_INFO_RESULT[0],
        storageUri: MOCK_MEMORY_INFO_RESULT[1],
        parent: MOCK_MEMORY_INFO_RESULT[2],
        creator: MOCK_MEMORY_INFO_RESULT[3],
        timestamp: MOCK_MEMORY_INFO_RESULT[4],
      });
    });

    it('calls readContract on the registry address with getSnapshot', async () => {
      mocks.readContract.mockResolvedValue(MOCK_MEMORY_INFO_RESULT);

      await client.getMemoryInfo(7n);

      expect(mocks.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: TEST_CONFIG.registryAddress,
          functionName: 'getSnapshot',
        }),
      );
    });
  });

  describe('loadMemory()', () => {
    it('calls getSnapshot with the correct tokenId', async () => {
      mocks.readContract.mockResolvedValue(MOCK_MEMORY_INFO_RESULT);

      // download mock returns null (success), but the tmp file won't exist →
      // readFile throws ENOENT, which causes loadMemory to reject
      await expect(client.loadMemory(7n)).rejects.toThrow();

      expect(mocks.readContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: 'getSnapshot', args: [7n] }),
      );
    });
  });

  describe('autoSnapshot()', () => {
    const SNAPSHOT_RESULT: SnapshotResult = {
      tokenId: 1n,
      contentHash: '0xhash0000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
      storageUri: '0g://abc123',
      txHash: '0xtxhash' as `0x${string}`,
      timestamp: 1000,
    };

    beforeEach(() => {
      vi.useFakeTimers();
      // Spy on snapshot so the interval callback resolves in 1 microtask tick,
      // allowing vi.advanceTimersByTimeAsync to properly await it.
      vi.spyOn(client, 'snapshot').mockResolvedValue(SNAPSHOT_RESULT);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('calls snapshot after intervalMs and invokes onSnapshot', async () => {
      const onSnapshot = vi.fn();
      const buildBundle = vi.fn().mockResolvedValue(MOCK_BUNDLE);

      client.autoSnapshot({ intervalMs: 1000, buildBundle, onSnapshot });

      await vi.advanceTimersByTimeAsync(1000);

      expect(buildBundle).toHaveBeenCalledTimes(1);
      expect(onSnapshot).toHaveBeenCalledWith(SNAPSHOT_RESULT);
    });

    it('calls onError when snapshot throws', async () => {
      const onError = vi.fn();
      vi.spyOn(client, 'snapshot').mockRejectedValue(new Error('chain error'));

      client.autoSnapshot({
        intervalMs: 500,
        buildBundle: vi.fn().mockResolvedValue(MOCK_BUNDLE),
        onError,
      });

      await vi.advanceTimersByTimeAsync(500);

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('returned unsubscribe stops further snapshots', async () => {
      const onSnapshot = vi.fn();
      const stop = client.autoSnapshot({
        intervalMs: 1000,
        buildBundle: vi.fn().mockResolvedValue(MOCK_BUNDLE),
        onSnapshot,
      });

      stop();
      await vi.advanceTimersByTimeAsync(3000);

      expect(onSnapshot).not.toHaveBeenCalled();
    });

    it('fires multiple times before unsubscribe', async () => {
      const onSnapshot = vi.fn();
      const stop = client.autoSnapshot({
        intervalMs: 1000,
        buildBundle: vi.fn().mockResolvedValue(MOCK_BUNDLE),
        onSnapshot,
      });

      await vi.advanceTimersByTimeAsync(3000);
      stop();

      expect(onSnapshot).toHaveBeenCalledTimes(3);
    });
  });
});
