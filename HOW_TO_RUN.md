# How to Integrate with Mnemos

This guide walks through integrating the Mnemos SDK into your AI agent, from installation to marketplace participation.

---

## Prerequisites

- Node.js >= 20
- A funded wallet on **0G Mainnet** (for gas and marketplace transactions)

> You do **not** need to deploy any contracts yourself. Mnemos operates as shared infrastructure — the MemoryRegistry and MemoryMarketplace contracts are already deployed on 0G Mainnet and are used by all agents integrating with the platform.

---

## Step 1: Install the SDK

```bash
npm install @mnemos/sdk @0gfoundation/0g-ts-sdk
```

> `@0gfoundation/0g-ts-sdk` is a required peer dependency for 0G Storage upload and download.

If you are consuming this repo directly, you can pin to the git URL instead:

```bash
npm install github:TarasBrilian/mnemos-backend#main
```

---

## Step 2: Set Up Environment Variables

Create a `.env` file in your project root with the following values:

```env
AGENT_PRIVATE_KEY=0x<your-wallet-private-key>

# 0G Mainnet — do not change these three values
OG_CHAIN_ID=16661
OG_RPC_URL=https://evmrpc.0g.ai
OG_STORAGE_NODE=https://indexer-storage-turbo.0g.ai

# Mnemos deployed contract addresses — do not change these
REGISTRY_ADDRESS=0x848F7000223dd2eBa5ac30b37d52EdA8D058E72E
MARKETPLACE_ADDRESS=0xFeb5Ac77Cd7746e2b35825dA800458D660D10209
```

> **Important — you must use 0G Mainnet (chain ID `16661`).**
> The contracts are deployed on mainnet, not on any testnet. Using a different chain ID or RPC will cause all contract calls to fail silently or revert. Do not change `OG_CHAIN_ID`, `OG_RPC_URL`, `OG_STORAGE_NODE`, `REGISTRY_ADDRESS`, or `MARKETPLACE_ADDRESS` — only `AGENT_PRIVATE_KEY` is yours to set.

The only value you need to supply is `AGENT_PRIVATE_KEY` — your own wallet's private key (hex, `0x`-prefixed). Make sure this wallet has enough A0GI balance to cover gas fees and any marketplace transactions you intend to make.

| Network | Chain ID | Explorer |
|---|---|---|
| **0G Mainnet** ✅ (use this) | `16661` | https://chainscan.0g.ai |
| 0G Galileo Testnet ❌ | `16602` | — |

---

## Step 3: Initialize `MnemosClient`

`MnemosClient` is the single entry point for all SDK operations. Create one instance per agent and reuse it.

```ts
import 'dotenv/config';
import { MnemosClient } from '@mnemos/sdk';

const mnemos = new MnemosClient({
  privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
  chainId: parseInt(process.env.OG_CHAIN_ID!),
  rpcUrl: process.env.OG_RPC_URL!,
  storageNodeUrl: process.env.OG_STORAGE_NODE!,
  registryAddress: process.env.REGISTRY_ADDRESS as `0x${string}`,
  marketplaceAddress: process.env.MARKETPLACE_ADDRESS as `0x${string}`,
});
```

---

## Step 4: Snapshot Your Agent's Memory

A snapshot encrypts your agent's current memory state, uploads it to 0G Storage, and mints a provenance NFT on-chain.

### One-time manual snapshot

```ts
import type { MemoryBundle } from '@mnemos/sdk';

const bundle: MemoryBundle = {
  data: {
    trades: [...],
    totalPnl: 1234.56,
  },
  metadata: {
    category: 'trading',    // 'trading' | 'research' | 'support' | 'gaming' | 'social'
    agentId: 'my-agent-v1',
    version: '1.0.0',
    createdAt: Date.now(),
    tags: ['defi', 'yield'],
  },
};

const result = await mnemos.snapshot(bundle);

console.log(result.tokenId);    // bigint — the minted NFT token ID
console.log(result.storageUri); // "0g://..." — content address on 0G Storage
console.log(result.txHash);     // on-chain transaction hash
```

### Recurring auto-snapshot (recommended for long-running agents)

`autoSnapshot` runs on an interval and returns an unsubscribe function. Errors are caught and passed to `onError` so the agent does not crash.

```ts
const stop = mnemos.autoSnapshot({
  intervalMs: 30_000,                // every 30 seconds (use 86_400_000 for daily in production)
  buildBundle: () => ({
    data: myAgent.getState(),
    metadata: {
      category: 'trading',
      agentId: 'my-agent-v1',
      version: '1.0.0',
    },
  }),
  onSnapshot: (result) => {
    console.log(`Snapshot minted — token ID: ${result.tokenId}`);
    console.log(`Storage URI: ${result.storageUri}`);
  },
  onError: (err) => {
    console.error(`Snapshot failed: ${err.message}`);
  },
});

// Stop the timer on shutdown
process.on('SIGINT', () => {
  stop();
  process.exit(0);
});
```

---

## Step 5: List Your Memory on the Marketplace (Optional)

After minting a snapshot, you can list the token for sale, rent, or fork.

```ts
const txHash = await mnemos.list(result.tokenId, {
  buyPrice:         BigInt('1000000000000000000'), // 1 A0GI in wei
  rentPricePerDay:  BigInt('100000000000000000'),  // 0.1 A0GI per day
  forkPrice:        BigInt('500000000000000000'),  // 0.5 A0GI to fork
  royaltyBps:       500,                           // 5% royalty on child-agent earnings
});

console.log(`Listed — tx: ${txHash}`);
```

Set `buyPrice` or `forkPrice` to `0n` to disable that option.

---

## Step 6: Consume Another Agent's Memory

### Check a listing

```ts
const listing = await mnemos.getListing(42n);

console.log(listing.seller);
console.log(listing.buyPrice.toString(), 'wei');
console.log(listing.rentPricePerDay.toString(), 'wei/day');
```

### Buy

```ts
const txHash = await mnemos.buy(42n);
```

The SDK reads the listing price automatically and sends the exact amount.

### Rent

```ts
const txHash = await mnemos.rent(42n, 7); // rent for 7 days
```

### Fork (create a derived memory token)

```ts
const txHash = await mnemos.fork(
  42n,                             // parent token ID
  parentInfo.contentHash,          // from getMemoryInfo()
  parentInfo.storageUri,
  listing.forkPrice,
);
```

### Download and decrypt memory

```ts
const bundle = await mnemos.loadMemory(42n);
console.log(bundle.data);
console.log(bundle.metadata);
```

> **Note:** Decryption only succeeds if your wallet matches the creator's wallet. This is a known MVP limitation — the v2 design uses threshold cryptography or a TEE to release the decryption key atomically with payment.

---

## Step 7: Pay Royalties (If Your Agent Is a Fork)

When your forked agent generates earnings, settle a share back to the parent creator:

```ts
const earningsInWei = BigInt('50000000000000000'); // 0.05 A0GI

await mnemos.payRoyalty(parentTokenId, earningsInWei);
```

---

## REST API Integration (No Private Key Required)

If you are integrating from a frontend or a service that should not hold a private key, use the NestJS REST API instead. Start it with `pnpm api:dev` (port 3001).

### Snapshot memory

```http
POST /api/memory/snapshot
Content-Type: application/json

{
  "data": { "trades": [{ "pair": "ETH/USDC", "amount": 1.5, "side": "buy" }] },
  "metadata": { "category": "trading", "agentId": "my-agent-v1", "version": "1.0.0" }
}
```

### Get on-chain provenance info

```http
GET /api/memory/1/info
```

### Get a marketplace listing

```http
GET /api/marketplace/listings/1
```

### List a token

```http
POST /api/marketplace/list
Content-Type: application/json

{
  "tokenId": "1",
  "price": "1000000000000000000",
  "rentalPricePerDay": "100000000000000000",
  "forkPrice": "500000000000000000",
  "forkRoyaltyBps": 500
}
```

---

## Integration Flow at a Glance

```
Your Agent
  └── new MnemosClient(config)
        │
        ├── autoSnapshot()
        │     └── encrypt → upload to 0G Storage → mintMemory on-chain → return tokenId
        │
        ├── list(tokenId, terms)
        │     └── MemoryMarketplace.list()
        │
        ├── buy(tokenId) / rent(tokenId, days)
        │     └── MemoryMarketplace.buy() / rent()  [reads price automatically]
        │
        ├── fork(parentTokenId, ...)
        │     └── MemoryMarketplace.fork()
        │
        ├── loadMemory(tokenId)
        │     └── getSnapshot() → download from 0G Storage → decrypt → return MemoryBundle
        │
        └── payRoyalty(parentTokenId, amount)
              └── MemoryMarketplace.payRoyalty()
```

---

## Running the Reference Agent

The reference agent in `apps/reference-agent/` is a working example that exercises the full SDK flow. Run it with:

```bash
pnpm sdk:build   # build the SDK first
pnpm agent:run   # start the DeFi yield explorer agent
```

It generates a trade event every 2 seconds and triggers an on-chain snapshot every 30 seconds. Watch your 0G Chain explorer to see tokens being minted in real time.
