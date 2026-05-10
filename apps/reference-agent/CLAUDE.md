# CLAUDE.md — apps/reference-agent/

Demonstrates the full Mnemos SDK lifecycle end-to-end against the live 0G Mainnet contracts: trade events appear in stdout → memory grows → snapshot triggers → token mints on 0G Chain → URI visible in explorer.

## What it does

- Generates a `TradeEvent` every 2 seconds via `setInterval`.
- Accumulates trades into an in-memory `AgentMemory` object (never persisted to disk).
- Calls `mnemos.autoSnapshot` with a 30-second interval to trigger on-chain mints.
- Logs each trade and each snapshot result to stdout.

## What it does NOT do

- Persist memory between restarts. `AgentMemory` is a plain in-memory object.
- Handle partial snapshots. If `autoSnapshot` fires before any trades, it still snapshots an empty trades array — this is intentional.

## Running it

Requires a populated `.env` at the workspace root (or this package's root). All env vars must be set:

```
AGENT_PRIVATE_KEY=0x...
OG_CHAIN_ID=16661
OG_RPC_URL=https://evmrpc.0g.ai
OG_STORAGE_NODE=https://indexer-storage-turbo.0g.ai
REGISTRY_ADDRESS=0x848F7000223dd2eBa5ac30b37d52EdA8D058E72E
MARKETPLACE_ADDRESS=0xFeb5Ac77Cd7746e2b35825dA800458D660D10209
```

Run with `pnpm agent:run` from the workspace root. Uses `tsx` — no build step needed.

## Entry point

Everything is in `src/index.ts`. There are no other source files.

## Extending

If you want to extend the agent:
- Vary the trade frequency based on simulated market volatility
- Add a second agent that forks from the first agent's snapshot
- Print a live summary table instead of per-trade lines
