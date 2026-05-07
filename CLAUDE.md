# CLAUDE.md — Mnemos backend (SDK + reference agent)

The "backend" of Mnemos isn't a server — it's a TypeScript library that agent developers import into their own runtime, plus a reference agent that exercises the library end-to-end. There's no API server, no database — all state lives on chain.

## Multi-repo context

Mnemos is split across three repos:

- **`mnemos-contract`** — Solidity contracts (the on-chain layer)
- **`mnemos-backend`** (this repo) — TypeScript SDK + reference agent
- **`mnemos-frontend`** — Next.js marketplace UI

This repo depends on `mnemos-contract` for: deployed contract addresses (read from env at runtime) and the ABI shape (encoded as literals in `client.ts`). When the contract changes, the SDK has to update its ABI literals to match — there is no automatic ABI sync. Stale ABIs cause silent encoder failures.

`mnemos-frontend` consumes this repo's published SDK (`@mnemos/sdk` on npm). Bumping the SDK version requires re-installing in the frontend repo. For the hackathon, you might pin to a git URL instead of publishing to npm — both work, the git pin is faster to iterate on.

## What this repo does

`packages/sdk/` is the published library. `MnemosClient` is the single entry point that wraps three concerns:

1. **Encryption + storage** — bundles agent memory into JSON, encrypts with a derived symmetric key, uploads to 0G Storage, returns a content-addressed URI.
2. **On-chain registration** — calls `MemoryRegistry.mintRoot` to record provenance: content hash, storage URI, creator, parent (for forks), timestamp.
3. **Marketplace operations** — list/buy/rent/fork through the `MemoryMarketplace` contract, plus `payRoyalty` for child agents settling earnings to parents.

Plus a convenience helper, `autoSnapshot`, that runs `snapshot()` on a configurable interval — this is what makes "5-line integration" possible from the agent developer's POV.

`apps/reference-agent/` is a simulated DeFi yield explorer. It generates synthetic trade events every 2 seconds and accumulates them into an in-memory `AgentMemory` object, then uses `mnemos.autoSnapshot` with a 30-second interval (sped up from production daily/weekly cadence) so the demo video can show snapshots being minted in real time.

The reference agent is a *demo*, not a product. It doesn't trade real markets. The point is making the snapshot flow visually compelling: trade → memory grows → snapshot triggers → token mints on chain → URI appears in 0G Explorer.

## Tech stack

`viem` for chain interaction (typed, modern, lighter than ethers). `tweetnacl` + `tweetnacl-util` for symmetric encryption (small, audited, fine for MVP). `@0glabs/0g-ts-sdk` is a peer dependency — verify the actual package name and current API at https://docs.0g.ai/ before integrating.

ESM-only output via `tsup`. The reference agent uses `"type": "module"` and `tsx` for direct TypeScript execution.

## Conventions

API design: producer-side methods (`snapshot`, `list`, `autoSnapshot`) return promises that resolve to clean objects (`SnapshotResult`, transaction hashes). Consumer-side methods (`buy`, `rent`, `fork`, `loadMemory`) take token IDs as `bigint`, never strings — `bigint` is the JS-native EVM integer type and avoids overflow surprises.

Errors: throw, don't return error tuples. Callers wrap in `try/catch`. The `autoSnapshot` helper provides `onError` callback because users typically want to log-and-continue rather than crash a long-running agent.

State: `MnemosClient` owns the `WalletClient`, `PublicClient`, and the `autoSnapshotTimer`. It's intended to be a singleton per-agent. Don't add caching or memoization to the client — let callers handle that at their layer.

Stubbed methods: `uploadToStorage` and `downloadFromStorage` are deliberately stubbed and noisy (they `console.warn` when called). Replacing these with real `@0glabs/0g-ts-sdk` calls is the **first thing** that needs to happen — until that's done, the SDK doesn't actually persist anything.

## Encryption design

Current MVP: symmetric key derived deterministically from the creator's wallet address (see `deriveSymmetricKey`). This means the creator can always decrypt their own memory, but **buyers can't decrypt without receiving the key out-of-band from the creator**.

This is a known gap. The production design:

1. Creator encrypts memory with a random symmetric key K.
2. K is split via threshold cryptography (or escrowed in a TEE).
3. The marketplace contract, on payment confirmation, releases K to the buyer (atomically with payment).
4. Renter case: K is time-bounded — re-released on each rental, expires with the rental window.

For the hackathon demo, the simplification is fine: the producer agent and the consumer agent both run with the same wallet during demo, so decryption "just works." Mention the threshold/TEE design in the pitch as v2.

## Common commands

```bash
pnpm sdk:build         # compile to dist/ via tsup, ESM + CJS + types
pnpm sdk:dev           # watch mode
pnpm agent:run         # start the reference agent (needs .env populated)
```

The agent reads addresses from environment variables that are populated by the contract repo's `Deploy.s.sol`. Order matters: deploy contracts first, copy addresses to this repo's `.env`, then run the agent.

## Cross-repo workflow

When iterating on contract changes locally:

1. Make change in `mnemos-contract`, redeploy to testnet (or to a local anvil).
2. Update the new addresses in this repo's `.env`.
3. If the function signature, args, or events changed: update the corresponding ABI entry in `packages/sdk/src/client.ts`. The ABIs there are minimal — only what the SDK actually calls.
4. Rebuild the SDK (`pnpm sdk:build`) before testing.

For local anvil iteration: spin up anvil in the contract repo, deploy to it, point both this repo and the frontend repo's `OG_RPC_URL` at `http://127.0.0.1:8545`. Faster than testnet round-trips.

## When extending

Adding a new on-chain method (e.g., calling a future `MemoryRegistry.attachAttestation`)? Update the relevant ABI literal at the top of `client.ts`, add the wrapper method, and export it. Keep the ABI literals minimal — only include functions actually called from JS.

Adding a new memory category convention? It's just a string in `MemoryMetadata.category` — no schema enforcement on chain. Document the convention in this file. Current canonical categories: `trading`, `research`, `support`, `gaming`, `social`. Add to this list when introducing a new one.

Changing the auto-snapshot trigger logic (e.g., snapshot on memory delta size threshold rather than time)? Replace `setInterval` with a more sophisticated mechanism, but keep `autoSnapshot` returning an unsubscribe function — that's the public contract callers depend on.

## Hackathon scope discipline

The SDK is the developer-facing surface — its DX matters more than its feature breadth. Spend time on:

- Clear types (`MemoryBundle`, `ListingTerms`) that read like spec
- Helpful error messages
- The 5-line example actually being 5 lines

Don't spend time on:

- Caching layer
- Retry logic with exponential backoff
- Browser bundling (this is a Node.js library; the frontend reads chain through wagmi separately)
- Mock mode / local-only mode (let users point at 0G testnet or local anvil)

If you find yourself adding a 10th method, ask whether it belongs in the SDK or in user code. The SDK should be a thin, opinionated wrapper — not a framework.