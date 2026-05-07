# CLAUDE.md — Mnemos backend (SDK + NestJS API + reference agent)

This repo contains three things: a TypeScript SDK library (`@mnemos/sdk`) that agent developers import, a NestJS REST API that the frontend consumes, and a reference agent that exercises the SDK end-to-end. All persistent state lives on chain — the API is stateless and wraps chain interactions.

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

`apps/api/` is the NestJS REST API. It wraps the SDK so the frontend doesn't need to hold a private key or talk directly to the chain for server-side operations. It has three modules:

- **MnemosModule** (`@Global`) — initialises `MnemosClient` from env vars, provides it to all other modules.
- **MarketplaceModule** — `GET /api/marketplace/listings/:tokenId`, `POST /api/marketplace/list|buy/:tokenId|rent/:tokenId|fork/:tokenId`.
- **MemoryModule** — `POST /api/memory/snapshot`, `GET /api/memory/:tokenId/info`, `GET /api/memory/:tokenId`.

The frontend still uses wagmi for user-signed transactions (buy/rent require the user's own wallet). The API handles server-side operations and read aggregation.

`apps/reference-agent/` is a simulated DeFi yield explorer. It generates synthetic trade events every 2 seconds and accumulates them into an in-memory `AgentMemory` object, then uses `mnemos.autoSnapshot` with a 30-second interval (sped up from production daily/weekly cadence) so the demo video can show snapshots being minted in real time.

The reference agent is a *demo*, not a product. It doesn't trade real markets. The point is making the snapshot flow visually compelling: trade → memory grows → snapshot triggers → token mints on chain → URI appears in 0G Explorer.

## Tech stack

`viem` for chain interaction (typed, modern, lighter than ethers). `tweetnacl` + `tweetnacl-util` for symmetric encryption (small, audited, fine for MVP). `@0glabs/0g-ts-sdk` is a peer dependency — verify the actual package name and current API at https://docs.0g.ai/ before integrating.

SDK: ESM-only output via `tsup`. The reference agent uses `"type": "module"` and `tsx` for direct TypeScript execution.

NestJS API: CommonJS (NestJS default). Uses `@nestjs/config` for env loading, `class-validator` + `class-transformer` for DTO validation. All bigint values are serialised as strings in API responses because JSON doesn't support bigint natively.

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
pnpm sdk:build         # compile SDK to dist/ via tsup, ESM + CJS + types
pnpm sdk:dev           # SDK watch mode
pnpm api:dev           # start NestJS API in watch mode (port 3001)
pnpm api:build         # compile NestJS API to dist/
pnpm api:start         # run compiled NestJS API (production)
pnpm agent:run         # start the reference agent (needs .env populated)
pnpm build             # sdk:build then api:build
```

All apps read addresses and keys from environment variables populated by the contract repo's `Deploy.s.sol`. Order matters: deploy contracts first, copy addresses to this repo's `.env`, then run the agent or API.

## Cross-repo workflow

When iterating on contract changes locally:

1. Make change in `mnemos-contract`, redeploy to testnet (or to a local anvil).
2. Update the new addresses in this repo's `.env`.
3. If the function signature, args, or events changed: update the corresponding ABI entry in `packages/sdk/src/client.ts`. The ABIs there are minimal — only what the SDK actually calls.
4. Rebuild the SDK (`pnpm sdk:build`) before testing.

For local anvil iteration: spin up anvil in the contract repo, deploy to it, point both this repo and the frontend repo's `OG_RPC_URL` at `http://127.0.0.1:8545`. Faster than testnet round-trips.

## When extending

Adding a new on-chain method (e.g., calling a future `MemoryRegistry.attachAttestation`)? Update the relevant ABI literal at the top of `client.ts`, add the wrapper method, and export it. Keep the ABI literals minimal — only include functions actually called from JS.

Adding a new API endpoint? Add a controller method + service method in the relevant module. DTOs go in `dto/` next to the module. Validate with `class-validator` decorators.

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