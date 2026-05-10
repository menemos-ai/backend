# CLAUDE.md — packages/sdk/src/

The SDK's entire public surface lives in three files: `types.ts`, `client.ts`, and `index.ts`.

## File responsibilities

- **`types.ts`** — all exported TypeScript types. No logic. When adding a type, put it here only.
- **`client.ts`** — `MnemosClient` class. ABI literals at the top, chain definition, then the class.
- **`index.ts`** — barrel export. Re-exports everything from `types.ts` and `MnemosClient` from `client.ts`. Nothing else.

## ABI literals

The two ABI arrays (`MEMORY_REGISTRY_ABI`, `MEMORY_MARKETPLACE_ABI`) are minimal by design — only functions actually called from JS are included. When `mnemos-contract` changes a function signature, update the matching entry here. Stale ABIs cause silent encode failures at runtime (viem won't throw until the tx is attempted).

Keep them `as const` — viem's type inference depends on it.

## Storage

`uploadToStorage` uses `@0gfoundation/0g-ts-sdk` (`Indexer.upload` + `MemData`). `downloadFromStorage` uses `Indexer.download` to a temp file then reads and deletes it. Both use a viem-to-ethers signer adapter so no separate ethers dependency is needed.

## Encryption

v2 key scheme: `contentHash = keccak256(plaintext JSON)` — used as both the on-chain content identifier and the 32-byte NaCl symmetric encryption key seed (`deriveContentKey`). Storage URIs are prefixed `v2:` on-chain. v1 tokens (no prefix) fall back to a wallet-address-derived key and can only be decrypted by the producer. See root CLAUDE.md for the access control model.

The `encrypt` method prepends the nonce to the ciphertext (nonce || box). `decrypt` reverses this. Don't change this layout — it's the wire format stored in 0G Storage.

## tokenId typing

All consumer-facing methods take `tokenId` as `bigint`. The contract returns `uint256`; viem maps this to `bigint`. Never accept or return tokenId as `number` or `string` inside the SDK — precision loss is a real risk for large token IDs.

## autoSnapshot contract

`autoSnapshot` must return an unsubscribe function. This is the public contract callers depend on. The timer is stored on `this.autoSnapshotTimer`; only one timer runs per client instance. Calling `autoSnapshot` a second time will start a second timer and leak the first — callers are responsible for calling the unsubscribe.

## What not to add here

- Caching of any kind
- Retry logic
- Browser bundle compatibility shims
- A second entry point

Keep the SDK thin. If a method would only be called by one specific agent use-case, it belongs in that agent's code, not here.
