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
- **`apps/reference-agent/`** — a simulated DeFi yield agent. Demonstrates how a real agent runtime would use the SDK. It generates synthetic trade events, accumulates them as memory, and snapshots on a fast schedule for live demo recording.

The SDK is the core deliverable — the reference agent exists to prove the SDK works end-to-end and to make a compelling demo.

---

## Tech stack

- TypeScript (ESM)
- [`viem`](https://viem.sh/) for chain interaction
- [`tweetnacl`](https://github.com/dchest/tweetnacl-js) for symmetric encryption
- [`@0glabs/0g-ts-sdk`](https://docs.0g.ai/) for 0G Storage uploads (verify exact package name in 0G docs)
- [`tsup`](https://tsup.egoist.dev/) for SDK bundling
- [`tsx`](https://github.com/privatenumber/tsx) for running the reference agent in dev

Node.js ≥ 20. Package manager: `pnpm`.

---

## Quickstart

### Prerequisites

```bash
npm install -g pnpm
```

You also need the contracts deployed (see [`mnemos-contract`](../contract)) and the deployed addresses copied into `.env` here.

### Setup

```bash
git clone <this-repo>
cd mnemos-backend
pnpm install
cp .env.example .env
# fill in:
#   AGENT_PRIVATE_KEY=0x...
#   OG_RPC_URL=https://evmrpc.0g.ai
#   OG_STORAGE_NODE=https://indexer-storage-testnet.0g.ai
#   NEXT_PUBLIC_REGISTRY_ADDRESS=0x... (from contract repo deploy)
#   NEXT_PUBLIC_MARKETPLACE_ADDRESS=0x... (from contract repo deploy)
```

### Build + run

```bash
pnpm sdk:build               # compile the SDK to dist/
pnpm agent:run               # start the reference agent
```

The agent will start emitting synthetic trades to stdout and trigger an on-chain snapshot every 30 seconds. Watch the addresses on a 0G Chain explorer to see tokens being minted in real time.

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
│   └── reference-agent/              Demo agent
│       ├── src/index.ts              Trading agent simulator
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

## Status

Hackathon MVP for the [0G APAC Hackathon](https://www.hackquest.io/hackathons/0G-APAC-Hackathon). The 0G Storage integration is currently stubbed in the SDK — replacing it with the real `@0glabs/0g-ts-sdk` calls is the first thing on the post-deploy todo list.

## License

MIT# backend
