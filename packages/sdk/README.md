# @mnemos-sdk/sdk

TypeScript SDK for storing, registering, and trading AI agent memory on [0G Storage](https://0g.ai) and EVM chains.

Agents use Mnemos to snapshot their memory on-chain — giving each snapshot a content-addressed URI, a token ID, and a provenance record. Snapshots can then be listed, bought, rented, or forked on the Mnemos marketplace.

## Installation

```bash
npm install @mnemos-sdk/sdk
# or
pnpm add @mnemos-sdk/sdk
```

Peer dependency (required only if using real 0G Storage uploads):

```bash
npm install @0gfoundation/0g-ts-sdk
```

## Quick start

```ts
import { MnemosClient } from '@mnemos-sdk/sdk';

const mnemos = new MnemosClient({
  privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
  rpcUrl: process.env.OG_RPC_URL!,
  storageNodeUrl: process.env.OG_STORAGE_NODE!,
  registryAddress: process.env.REGISTRY_ADDRESS as `0x${string}`,
  marketplaceAddress: process.env.MARKETPLACE_ADDRESS as `0x${string}`,
});

mnemos.autoSnapshot({
  intervalMs: 24 * 60 * 60 * 1000, // daily
  buildBundle: () => ({
    data: { summary: 'agent memory here' },
    metadata: { category: 'trading' },
  }),
  onSnapshot: (result) => console.log('Minted token', result.tokenId, result.txHash),
  onError: (err) => console.error('Snapshot failed:', err.message),
});
```

## Configuration

| Field | Type | Description |
|---|---|---|
| `privateKey` | `` `0x${string}` `` | Agent wallet private key |
| `chainId` | `number` | EVM chain ID (optional, defaults to env `OG_CHAIN_ID`) |
| `rpcUrl` | `string` | RPC endpoint for the 0G network |
| `storageNodeUrl` | `string` | 0G Storage indexer node URL |
| `registryAddress` | `` `0x${string}` `` | Deployed `MemoryRegistry` contract address |
| `marketplaceAddress` | `` `0x${string}` `` | Deployed `MemoryMarketplace` contract address |
| `storageMock` | `boolean` | Skip real 0G Storage upload and use an in-memory stub URI — for unit testing only |

## API

### `snapshot(bundle, parentTokenId?)`

Encrypts the bundle, uploads it to 0G Storage, and mints an NFT on-chain recording the content hash and storage URI.

```ts
const result = await mnemos.snapshot({
  data: agentMemory,
  metadata: { category: 'trading', tags: ['defi', 'yield'] },
});
// result: { tokenId, contentHash, storageUri, txHash, timestamp }
```

### `autoSnapshot(options)`

Runs `snapshot` on a recurring interval. Returns an unsubscribe function.

```ts
const stop = mnemos.autoSnapshot({
  intervalMs: 30_000,
  buildBundle: () => ({ data: myMemory, metadata: { category: 'research' } }),
  onSnapshot: (r) => console.log('token:', r.tokenId),
  onError: (e) => console.error(e),
});

// later:
stop();
```

### `list(tokenId, terms)`

List a memory token on the marketplace.

```ts
await mnemos.list(tokenId, {
  buyPrice: parseEther('1'),
  rentPricePerDay: parseEther('0.01'),
  forkPrice: parseEther('0.5'),
  royaltyBps: 500, // 5%
});
```

### `buy(tokenId)`

Buy a listed memory token. Payment amount is read from the listing automatically.

```ts
const txHash = await mnemos.buy(42n);
```

### `rent(tokenId, durationDays)`

Rent a memory token for N days.

```ts
const txHash = await mnemos.rent(42n, 7);
```

### `fork(parentTokenId, contentHash, storageURI, value)`

Fork a parent memory into a new token, preserving provenance.

```ts
const txHash = await mnemos.fork(parentId, contentHash, storageUri, forkPrice);
```

### `payRoyalty(parentTokenId, amount)`

Send royalty earnings to a parent token's creator.

```ts
await mnemos.payRoyalty(parentId, parseEther('0.05'));
```

### `loadMemory(tokenId)`

Download and decrypt a memory bundle from 0G Storage.

```ts
const bundle = await mnemos.loadMemory(42n);
```

### `getListing(tokenId)`

Read marketplace listing terms for a token.

```ts
const { buyPrice, rentPricePerDay, seller } = await mnemos.getListing(42n);
```

### `getMemoryInfo(tokenId)`

Read on-chain metadata for a token.

```ts
const { contentHash, storageUri, creator, timestamp } = await mnemos.getMemoryInfo(42n);
```

## Types

```ts
type MemoryCategory = 'trading' | 'research' | 'support' | 'gaming' | 'social' | string;

interface MemoryBundle {
  data: unknown;
  metadata: MemoryMetadata;
}

interface MemoryMetadata {
  category: MemoryCategory;
  agentId?: string;
  version?: string;
  createdAt?: number;
  tags?: string[];
}

interface ListingTerms {
  buyPrice: bigint;
  rentPricePerDay: bigint;
  forkPrice: bigint;
  royaltyBps: number; // basis points (500 = 5%)
}

interface SnapshotResult {
  tokenId: bigint;
  contentHash: `0x${string}`;
  storageUri: string;
  txHash: `0x${string}`;
  timestamp: number;
}
```

## Requirements

- Node.js >= 20
- An EVM-compatible private key funded with native tokens for gas

## License

MIT
