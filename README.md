# Mnemos — Backend (SDK + Reference Agent)

> The TypeScript layer of Mnemos: a client SDK that agent developers drop into their runtime, plus a reference agent that demonstrates the full lifecycle.

This is one of three repositories that make up Mnemos:

| Repo | Purpose |
|---|---|
| [`mnemos-contract`](../contract) | Solidity contracts deployed to 0G Chain |
| [`mnemos-backend`](.) (this repo) | TypeScript SDK + reference agent |
| [`mnemos-frontend`](../frontend) | Next.js marketplace UI |

---

## What's in here

This repo is a small monorepo of two TypeScript packages:

- **`packages/sdk/`** — `@mnemos/sdk`. The public client library. Agent developers `npm install @mnemos/sdk` and integrate with five lines of code: their agent's memory gets auto-snapshotted to 0G Storage, minted as a memory token on 0G Chain, and made available for sale, rent, or fork on the marketplace.
- **`apps/reference-agent/`** — a DeFi yield agent that demonstrates the full SDK lifecycle end-to-end against the live 0G Mainnet contracts.

---

## Tech stack

- TypeScript (ESM)
- [`viem`](https://viem.sh/) for chain interaction
- [`tweetnacl`](https://github.com/dchest/tweetnacl-js) for symmetric encryption
- [`@0gfoundation/0g-ts-sdk`](https://docs.0g.ai/) for 0G Storage uploads and downloads
- [`tsup`](https://tsup.egoist.dev/) for SDK bundling
- [`tsx`](https://github.com/privatenumber/tsx) for running the reference agent in dev

Node.js ≥ 20. Package manager: `pnpm`.

---

## Quickstart

### Prerequisites

```bash
npm install -g pnpm
```

The Mnemos contracts are already deployed on 0G Mainnet — you do not need to deploy anything. See `HOW_TO_RUN.md` for the exact env var values to use.

### Setup

```bash
git clone <this-repo>
cd mnemos-backend
pnpm install
cp .env.example .env
# fill in:
#   AGENT_PRIVATE_KEY=0x...         your wallet private key
#   OG_CHAIN_ID=16661
#   OG_RPC_URL=https://evmrpc.0g.ai
#   OG_STORAGE_NODE=https://indexer-storage-turbo.0g.ai
#   REGISTRY_ADDRESS=0x848F7000223dd2eBa5ac30b37d52EdA8D058E72E
#   MARKETPLACE_ADDRESS=0xFeb5Ac77Cd7746e2b35825dA800458D660D10209
```

### Build + run

```bash
pnpm sdk:build               # compile the SDK to dist/
pnpm agent:run               # start the reference agent
```

The agent will start emitting trades to stdout and trigger an on-chain snapshot every 30 seconds. Watch the addresses on the [0G Chain explorer](https://chainscan.0g.ai) to see tokens being minted in real time.

---

## Repository layout

```
mnemos-backend/
├── packages/
│   └── sdk/                          @mnemos/sdk
│       ├── src/
│       │   ├── client.ts             MnemosClient main class
│       │   ├── types.ts              Public types
│       │   └── index.ts              Barrel export
│       ├── examples/
│       │   └── basic-integration.ts  5-line integration sample
│       └── package.json
│
├── apps/
│   └── reference-agent/              Reference agent
│       ├── src/index.ts              DeFi yield agent entry point
│       └── package.json
│
├── package.json                      Workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── README.md                         (this file)
└── CLAUDE.md                         Guidance for Claude Code
```

---

## Five-line integration

Once published, this is what an agent developer needs to integrate Mnemos:

```typescript
import { MnemosClient } from "@mnemos/sdk";

const mnemos = new MnemosClient({
  privateKey: process.env.AGENT_PRIVATE_KEY,
  rpcUrl: process.env.OG_RPC_URL,
  storageNodeUrl: process.env.OG_STORAGE_NODE,
  registryAddress: process.env.REGISTRY_ADDRESS,
  marketplaceAddress: process.env.MARKETPLACE_ADDRESS,
});

mnemos.autoSnapshot({
  intervalMs: 24 * 60 * 60 * 1000,           // daily
  buildBundle: () => ({ data: agent.memory, metadata: { category: "trading" } }),
});
```

That's it. The agent's memory is now an on-chain asset.

---

## Common commands

```bash
pnpm sdk:build               # bundle SDK to dist/ (cjs + esm + types)
pnpm sdk:dev                 # watch mode
pnpm agent:run               # run reference agent
```

---

## License

MIT# backend
