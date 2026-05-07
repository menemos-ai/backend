# CLAUDE.md — apps/reference-agent/

This is a demo, not a product. Its sole purpose is making the snapshot flow visually compelling for hackathon judges: trade events appear in stdout → memory grows → snapshot triggers → token mints on 0G Chain → URI visible in explorer.

## What it does

- Generates a synthetic `TradeEvent` every 2 seconds via `setInterval`.
- Accumulates trades into an in-memory `AgentMemory` object (never persisted to disk).
- Calls `mnemos.autoSnapshot` with a 30-second interval to trigger on-chain mints.
- Logs each trade and each snapshot result to stdout.

The 30-second interval is a demo speed-up. Production agents would use daily/weekly cadence.

## What it does NOT do

- Trade real markets. All prices and PnL are `Math.random()`.
- Persist memory between restarts. `AgentMemory` is a plain in-memory object.
- Handle partial snapshots. If `autoSnapshot` fires before any trades, it still snapshots an empty trades array — this is fine for demo purposes.

## Running it

Requires a populated `.env` at the workspace root (or this package's root). All five env vars must be set:

```
AGENT_PRIVATE_KEY=0x...
OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_STORAGE_NODE=https://indexer-storage-testnet.0g.ai
REGISTRY_ADDRESS=0x...
MARKETPLACE_ADDRESS=0x...
```

Run with `pnpm agent:run` from the workspace root. Uses `tsx` — no build step needed.

## Entry point

Everything is in `src/index.ts`. There are no other source files. Keep it that way — this is a demo script, not a structured application.

## Extending for demo

If you want to make the demo more compelling:
- Vary the trade frequency based on simulated "market volatility"
- Add a second agent that forks from the first agent's snapshot
- Print a live summary table instead of per-trade lines

Don't add persistence, real market data feeds, or error recovery. Scope creep here steals time from the SDK.
