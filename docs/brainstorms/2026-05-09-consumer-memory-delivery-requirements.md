# Consumer Memory Delivery — Requirements

**Date:** 2026-05-09
**Status:** Ready for planning
**Scope:** Standard

---

## Problem

When a consumer performs `buy`, `rent`, or `fork` on the marketplace, they receive nothing actionable. The on-chain transaction succeeds — NFT ownership transfers, rental expiry is recorded, child token is minted — but the consumer cannot read the encrypted memory bundle they just paid for.

**Root cause:** `deriveSymmetricKey()` in `packages/sdk/src/client.ts:333` derives the encryption key from the *producer's* wallet address. When a consumer calls `loadMemory(tokenId)`, they derive a key from *their own* wallet address. The keys do not match. Decryption always fails.

---

## Goals

1. Consumer can call `mnemos.loadMemory(tokenId)` and receive the actual `MemoryBundle` after a successful buy or rent.
2. Fork consumer can load the parent bundle as a starting point, build a child bundle, then snapshot and call `fork()`.
3. Backend API demonstrates a production-grade access-control path for the pitch.

## Non-goals

- TEE-based key release (v2 roadmap)
- Threshold cryptography or Lit Protocol integration
- Browser-side decryption (consumers run Node.js agents)
- Changing the on-chain contract

---

## Decision: Two-layer delivery

### Layer 1 — Token-key scheme (hackathon demo, ~20 lines of code)

Change the key derivation so that both producer and consumer derive the *same* key from publicly available on-chain data.

**New scheme:** Key = first 32 bytes of `keccak256(plaintext JSON)`, which is also what we store as `contentHash` on-chain.

Flow for producer (snapshot):
1. Serialize bundle to JSON string
2. Compute `contentHash = keccak256(plaintext)` — this becomes the on-chain content hash AND the encryption key seed
3. Encrypt bundle using `contentHash` as key
4. Upload encrypted bytes to 0G Storage → `storageURI`
5. Mint memory token with `(contentHash, storageURI)`

Flow for consumer (loadMemory):
1. `getSnapshot(tokenId)` → reads `contentHash` from chain
2. Derive key from `contentHash` (same derivation producer used)
3. `downloadFromStorage(storageURI)` → encrypted bytes
4. Decrypt → plaintext JSON → `MemoryBundle`

**Security posture for demo:** Anyone with `tokenId` can derive the key from the on-chain `contentHash`. This is acceptable for hackathon: the on-chain buy/rent records still enforce *who paid* and *who has access according to the protocol*. The narrative holds — cryptographic enforcement is v2 via TEE.

**Note:** `contentHash` in `MemorySnapshot` will now be the hash of the *plaintext* bundle (semantically more correct — it identifies the content, not the encryption artifact).

### Layer 2 — Backend API with chain verification (production pitch)

The existing `GET /api/memory/:tokenId` endpoint is extended to:

1. Accept an `Authorization` header: `Bearer <hex signature of a standard challenge message>`
2. Recover caller address from the signature (EIP-191 `personal_sign`)
3. Read chain to verify access:
   - Buy path: `registry.ownerOf(tokenId) == callerAddress`
   - Rent path: `marketplace.isCurrentRenter(tokenId, callerAddress) == true`
4. If authorized: backend decrypts the bundle using its own AGENT_PRIVATE_KEY (producer key), returns plaintext `MemoryBundle` JSON
5. If not authorized: `403 Forbidden`

The challenge message the caller signs can be a fixed string like `"mnemos:access:<tokenId>:<callerAddress>"`. This prevents replay across tokens.

**Who calls this:** A consumer agent that has a wallet but does not want to expose the key derivation scheme. They prove their identity via signature, the API gate does the on-chain check, the server decrypts on their behalf.

---

## Fork flow (SDK-level workflow)

Fork is a 4-step workflow entirely in the consumer's agent code:

```
1. loadMemory(parentTokenId)          → parent MemoryBundle
2. agent builds child bundle          → mix parent data with own data
3. mnemos.snapshot(childBundle)       → childTokenId, childStorageURI, childContentHash
4. mnemos.fork(parentTokenId,         → on-chain fork tx
               childContentHash,
               childStorageURI,
               forkPrice)
```

The SDK does not need a dedicated `forkMemory()` helper — steps 1–4 are already expressible with existing methods. The reference agent's CLAUDE.md and the frontend fork panel copy should describe this 4-step pattern explicitly.

---

## Files affected

| File | Change |
|---|---|
| `packages/sdk/src/client.ts` | Change `deriveSymmetricKey()` → key from contentHash. Update `snapshot()` to compute plaintext contentHash first. Update `loadMemory()` to read contentHash and derive key. |
| `packages/sdk/src/types.ts` | No changes required |
| `apps/api/src/memory/memory.controller.ts` | Add `Authorization` header parsing, challenge recovery |
| `apps/api/src/memory/memory.service.ts` | Add `verifyAccess(tokenId, callerAddress)` method — reads chain |
| `apps/api/src/common/` | Add `wallet-auth.guard.ts` (NestJS guard for signature verification) |
| `packages/sdk/examples/basic-integration.ts` | Add consumer-side example (loadMemory after buy) |

---

## Success criteria

- [ ] Producer agent snapshots → token minted with new contentHash scheme
- [ ] Consumer agent (different wallet) calls `loadMemory(tokenId)` after buy → receives correct `MemoryBundle`
- [ ] Consumer agent calls `loadMemory(tokenId)` after rent → receives correct `MemoryBundle`
- [ ] Fork 4-step flow works end-to-end in reference agent
- [ ] `GET /api/memory/:tokenId` with valid signature + verified on-chain access → returns decrypted bundle
- [ ] `GET /api/memory/:tokenId` with invalid/missing signature → 403

---

## Open questions

- **contentHash backward compatibility:** Tokens minted before this change use `keccak256(encrypted)` as contentHash. They will be unreadable with the new scheme. Acceptable for hackathon (just remint). Note in pitch: "production deployment versioning" is a v2 consideration.
- **Challenge replay window:** The signed challenge `"mnemos:access:<tokenId>:<callerAddress>"` has no timestamp — replay is possible until the rental expires or ownership changes. For demo this is fine; production would add a nonce or timestamp.
