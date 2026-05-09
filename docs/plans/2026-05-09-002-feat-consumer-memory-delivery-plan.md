---
title: "feat: Consumer memory delivery — content-hash key scheme + API auth"
type: feat
status: active
date: 2026-05-09
origin: docs/brainstorms/2026-05-09-consumer-memory-delivery-requirements.md
---

# feat: Consumer memory delivery — content-hash key scheme + API auth

## Overview

Consumers who buy, rent, or fork a memory token currently receive nothing actionable: the SDK's `loadMemory()` always fails because it tries to decrypt with the caller's own wallet-derived key, not the producer's. This plan fixes that in two layers: (1) a content-hash key scheme that lets any caller derive the decryption key from on-chain data, and (2) a backend API auth gate that enforces contractual access rights before serving decrypted bundles.

**Important privacy posture:** The v2 key scheme stores the decryption key (contentHash) on-chain alongside the ciphertext. This means any actor who can read the chain can decrypt any v2 bundle. There is **no cryptographic confidentiality** in the v2 scheme — access control is social + on-chain records, not cryptographic. This is explicitly acceptable for the hackathon demo and must not be pitched as "encrypted memory" without the caveat that the key is public. TEE-based key release (v2 roadmap) provides the cryptographic enforcement.

---

## Problem Frame

`deriveSymmetricKey()` in `packages/sdk/src/client.ts` derives the encryption key from the producer's wallet address. When a different wallet calls `loadMemory()`, it derives a different key → decryption always throws. This is the only blocker to a working buy/rent/fork flow.

Root cause identified, no ambiguity. The fix is a scheme change, not a contract change.

(see origin: `docs/brainstorms/2026-05-09-consumer-memory-delivery-requirements.md`)

---

## Requirements Trace

- R1. Consumer can call `mnemos.loadMemory(tokenId)` with a different wallet and receive the correct `MemoryBundle` after buy or rent.
- R2. Fork: consumer can loadMemory(parentTokenId) as starting point, build child bundle, then snapshot + fork.
- R3. `GET /api/memory/:tokenId` with valid wallet signature + on-chain access → returns decrypted bundle.
- R4. `GET /api/memory/:tokenId` without or with invalid signature → 403 Forbidden.
- R5. Existing tests in `client.spec.ts` must pass (currently all fail — see Discovered Issues).
- R6. Tokens minted before this change remain readable via v1 fallback.

---

## Scope Boundaries

- No contract changes — contract is already deployed on 0G testnet.
- No TEE-based key release (v2 roadmap).
- No browser-side decryption (consumers are Node.js agents).
- No integration tests against a live chain (out of hackathon scope — unit tests with mocks cover all cases).

### Deferred to Follow-Up Work

- Challenge replay nonce storage (stateless server means nonces can't be deduplicated across restarts; post-hackathon).
- Per-buyer key encryption (ECIES, Lit Protocol) — pitch as v2 roadmap item.

---

## Discovered Issues (Must Fix First)

All tests in `packages/sdk/src/client.spec.ts` currently fail because they were written for a different API design. Specific mismatches:

| Issue | Test expects | Actual in client.ts / contract |
|---|---|---|
| Mint function name | `mintRoot` | `mintMemory` |
| Mint args count | 3 (with parentTokenId) | 2 (contentHash, storageURI) |
| Info function name | `getMemoryInfo` | `getSnapshot` |
| Field order in snapshot result | `[hash, uri, creator, parent, ts]` | `[hash, uri, parent, creator, ts]` |
| `fork()` signature | 1 arg (parentTokenId) | 4 args (parentId, hash, uri, value) |
| `ListingTerms` fields | `price`, `isForSale/Rent/Fork` | `buyPrice`, `rentPricePerDay`, `forkPrice` |
| `TEST_CONFIG` | Missing `chainId` | Required by `MnemosClientConfig` |

These are all in `client.spec.ts` — the production code (`client.ts`) and contract are consistent with each other.

---

## Context & Research

### Relevant Code and Patterns

- `packages/sdk/src/client.ts` — `MnemosClient`. Encryption in `encrypt()`/`decrypt()`/`deriveSymmetricKey()`. Key change scope: 3 private methods + `snapshot()` + `loadMemory()`.
- `packages/sdk/src/types.ts` — `MnemosClientConfig`, `MemoryBundle`, `ListingTerms`, `SnapshotResult`, `MemoryInfo`. No changes required.
- `apps/api/src/memory/memory.controller.ts` — `GET /:tokenId` endpoint. Guard attaches here.
- `apps/api/src/memory/memory.service.ts` — Delegates to repository, handles chain errors.
- `apps/api/src/memory/memory.repository.ts` — Calls `mnemos.getClient().loadMemory()`.
- `apps/api/src/memory/memory.repository.interface.ts` — `IMemoryRepository` interface; `loadMemory` signature changes here.
- `apps/api/src/common/chain-error.util.ts` — Error translation pattern used in all services.
- `apps/api/src/marketplace/marketplace.repository.ts` — Pattern reference: wraps SDK client calls, shows how to compose multi-step operations.
- `apps/api/src/mnemos/mnemos.service.ts` — Singleton `MnemosClient` accessor via `getClient()`.
- `contract/src/MemoryRegistry.sol` — `getSnapshot()` returns `[contentHash, storageURI, parentTokenId, creator, createdAt]`. `ownerOf(tokenId)` from ERC-721.
- `contract/src/MemoryMarketplace.sol` — `isCurrentRenter(tokenId, renter)` returns bool.

### Test Patterns

- SDK tests: vitest, mocks at module level via `vi.mock('viem')`. Each test suite uses `vi.clearAllMocks()` in `beforeEach`.
- API tests: Jest + supertest. Controller tests build a minimal NestJS app with mocked service; service tests use constructor injection with mock repo.
- NestJS guards: `@UseGuards(WalletAuthGuard)` decorator on controller method. Guard class implements `CanActivate`, can inject services via DI.

### External References

- NestJS Guards: can implement `CanActivate`, receive `ExecutionContext`, inject providers. Use `@Injectable()` decorator.
- viem `recoverMessageAddress({ message, signature })` — recovers signer from EIP-191 personal_sign message.
- EIP-191 personal_sign prefix: `\x19Ethereum Signed Message:\n` + length + message.

---

## Key Technical Decisions

- **contentHash = keccak256(plaintext JSON), not keccak256(encrypted):** Makes contentHash semantically correct (identifies content) and derivable by any consumer from chain data. (see origin)
- **Version prefix in storageURI (`v2:` prefix):** `snapshot()` stores `v2:0g://rootHash` on-chain. `loadMemory()` reads prefix to select key scheme. `downloadFromStorage()` strips the version prefix before passing to 0G SDK. This is backward compatible — legacy tokens have URIs without `v2:`. (decision: user chose versioned URI over dual-mode decrypt, over remint-and-ignore)
- **Explicit key parameter on `encrypt()`/`decrypt()`:** Removes implicit dependency on wallet address. Makes key source visible at call site.
- **`deriveWalletKey()` kept for v1 backward compat:** Renamed from `deriveSymmetricKey()`, only called in `loadMemory()` for non-`v2:` URIs.
- **`hasAccess(tokenId, address)` added to `MnemosClient`:** Reads `ownerOf` (registry) and `isCurrentRenter` (marketplace) in parallel. Keeps chain access logic in SDK, not scattered across API layers.
- **API auth: stateless challenge with 5-minute timestamp window:** Challenge = `mnemos:access:<tokenId>:<callerAddress>:<unixTimestampSeconds>`. Caller also sends `X-Wallet-Timestamp` header. Server checks `|now - timestamp| <= 300`. No nonce storage needed. (decision: user chose timestamp over no-expiry)
- **Guard handles signature only; service handles chain access:** Clean separation — guard is stateless crypto verification, service/repo does on-chain check. Guard puts recovered address on the request object.
- **`loadMemory()` signature in repository stays `(tokenId, callerAddress)` as optional:** Caller address is passed through from controller → service → repository → client. When `callerAddress` is provided, `hasAccess()` is called. When absent (internal use, e.g. reference agent's own tokens), skip access check.
- **Fix tests before adding feature (U1 before U2):** Tests must pass at baseline before adding new behavior; this prevents confusing failures from mixing old bugs with new changes.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Content-hash key scheme flow

```
Producer (snapshot):
  json = JSON.stringify(bundle)
  contentHash = keccak256(toHex(decodeUTF8(json)))   ← plaintext hash = on-chain key seed
  key = hexToBytes(contentHash)                       ← 32 bytes, NaCl-ready
  encrypted = encrypt(json, key)
  rawUri = uploadToStorage(encrypted)                 → "0g://rootHash"
  versionedUri = "v2:" + rawUri                       → "v2:0g://rootHash"
  mintMemory(contentHash, versionedUri)               ← both stored on-chain

Consumer (loadMemory):
  info = getSnapshot(tokenId)                         → { contentHash, storageUri }
  isV2 = storageUri.startsWith("v2:")
  rawUri = isV2 ? storageUri.slice(3) : storageUri
  key = isV2 ? hexToBytes(info.contentHash)           ← derive from chain
             : deriveWalletKey()                       ← legacy fallback
  encrypted = downloadFromStorage(rawUri)
  return JSON.parse(decrypt(encrypted, key))
```

### API auth flow

```
Consumer agent:
  timestamp = Math.floor(Date.now() / 1000).toString()
  challenge = `mnemos:access:${tokenId}:${address}:${timestamp}`
  signature = await wallet.signMessage(challenge)
  GET /api/memory/:tokenId
    X-Wallet-Address: 0xConsumer...
    X-Wallet-Timestamp: 1234567890
    X-Wallet-Signature: 0xsig...

WalletAuthGuard:
  challenge = "mnemos:access:" + tokenId + ":" + address + ":" + timestamp
  recovered = recoverMessageAddress(message: challenge, signature)
  assert recovered == address
  assert |now - timestamp| <= 300 seconds
  request.walletAddress = recovered

MemoryService.loadMemory(tokenId, callerAddress):
  hasAccess = client.hasAccess(tokenId, callerAddress)
  if !hasAccess → throw ForbiddenException
  return client.loadMemory(tokenId)
```

---

## Implementation Units

- U1. **Fix client.spec.ts to match current implementation**

**Goal:** Establish a passing test baseline before adding new feature code.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `packages/sdk/src/client.spec.ts`

**Approach:**
- Add `chainId: 0` to `TEST_CONFIG` (mocked, value irrelevant for unit tests).
- Fix `snapshot()` tests: `mintRoot` → `mintMemory`; args pattern `[contentHash: string, storageUri: string]` (2 args, no parentTokenId); fix parentTokenId test to check `args[2]` = `0n` only when contract supports it — since current contract `mintMemory` takes only 2 args, remove the parentTokenId arg assertions; keep the token ID extraction from receipt log topic test unchanged.
- Fix `list()` tests: update `ListingTerms` local variable to use `buyPrice`, `rentPricePerDay`, `forkPrice`, `royaltyBps` (matching `types.ts`); expected args `[tokenId, buyPrice, rentPricePerDay, forkPrice, royaltyBps]` (5 args).
- Fix `fork()` test: `client.fork()` takes 4 args — add a mock contentHash, storageURI string, and value bigint. Assert `args: [9n, expect.any(String), expect.any(String)]` and `value: expect.any(BigInt)`.
- Fix `getListing()` tests: update `MOCK_LISTING_RESULT` to match contract struct order `[seller, buyPrice, rentPricePerDay, forkPrice, royaltyBps]` and correct types (no booleans). Assert returned object has `{ seller, buyPrice, rentPricePerDay, forkPrice, royaltyBps }`.
- Fix `getMemoryInfo()` tests: `functionName: 'getSnapshot'` (not `getMemoryInfo`); fix `MOCK_MEMORY_INFO_RESULT` field order to match contract struct `[contentHash, storageURI, parentTokenId, creator, createdAt]`; update `MOCK_MEMORY_INFO_RESULT[2]` → now `parent` (bigint 0n), `MOCK_MEMORY_INFO_RESULT[3]` → `creator` (address string).
- Remove `mintRoot` snapshot args (parentTokenId as 3rd arg) since current `mintMemory` does not take parentTokenId.

**Patterns to follow:**
- Existing mock pattern: `vi.hoisted()` for mocks, `vi.mock('viem')` factory at module level.
- `expect.objectContaining()` for partial match on writeContract calls.

**Test scenarios:**
- Happy path: all existing tests in `client.spec.ts` pass after fixing mock data.
- Verify: run `pnpm --filter @mnemos/sdk test` after changes; zero failures.

**Verification:**
- `pnpm --filter @mnemos/sdk test` exits 0 with no failures.

---

- U2. **Content-hash key derivation + versioned URI in SDK client**

**Goal:** Producer and consumer can derive the same decryption key from on-chain data. Backward compat via `v2:` URI prefix.

**Requirements:** R1, R2, R6

**Dependencies:** U1 (must have passing baseline before changing behavior)

**Files:**
- Modify: `packages/sdk/src/client.ts`

**Approach:**
- Change `encrypt(data: string): Uint8Array` → `encrypt(data: string, key: Uint8Array): Uint8Array`. Key is passed explicitly; method uses it directly.
- Change `decrypt(data: Uint8Array): string` → `decrypt(data: Uint8Array, key: Uint8Array): string`. Same — explicit key.
- Rename `deriveSymmetricKey(): Uint8Array` → `deriveWalletKey(): Uint8Array`. Kept for v1 backward compat only. No logic change.
- In `snapshot(bundle, parentTokenId?)`:
  - Serialize to JSON, compute `contentHash = keccak256(toHex(decodeUTF8(json)))`.
  - Derive `key = hexToBytes(contentHash)` (32 bytes — direct NaCl key).
  - Call `encrypt(json, key)`.
  - Upload encrypted bytes → `rawUri`.
  - Store on-chain: `storageUri = 'v2:' + rawUri`, `contentHash = contentHash`.
  - `writeContract({ functionName: 'mintMemory', args: [contentHash, versionedUri] })`.
  - Return `SnapshotResult` with `storageUri` = the versioned URI.
- In `loadMemory(tokenId)`:
  - Read info from chain (`getMemoryInfo`).
  - Check `info.storageUri.startsWith('v2:')`.
  - If v2: `rawUri = info.storageUri.slice(3)`, `key = hexToBytes(info.contentHash)`.
  - Else (v1): `rawUri = info.storageUri`, `key = this.deriveWalletKey()`.
  - `downloadFromStorage(rawUri)` → encrypted bytes.
  - `decrypt(encrypted, key)` → plaintext → parse as `MemoryBundle`.
- Add `async hasAccess(tokenId: bigint, address: `0x${string}`): Promise<boolean>`:
  - Use `Promise.allSettled` (not `Promise.all`) to run `readContract(registry, 'ownerOf', [tokenId])` and `readContract(marketplace, 'isCurrentRenter', [tokenId, address])` in parallel.
  - `ownerOf` reverts on ERC-721 for non-existent tokens — `Promise.allSettled` prevents this from propagating as an uncaught rejection.
  - Result: `(ownerResult.status === 'fulfilled' && ownerResult.value === address) || (renterResult.status === 'fulfilled' && renterResult.value === true)`.
  - Add `ownerOf` to `MEMORY_REGISTRY_ABI` (ERC-721, `inputs: [tokenId: uint256]`, `outputs: [address]`, `stateMutability: view`).
  - Add `isCurrentRenter` to `MEMORY_MARKETPLACE_ABI` (already in contract: `inputs: [tokenId: uint256, renter: address]`, `outputs: [bool]`, `stateMutability: view`).

**Patterns to follow:**
- ABI literals at top of `client.ts` — add new entries there, keeping them `as const`.
- `this.publicClient.readContract()` call pattern — already used in `getListing()` and `getMemoryInfo()`.

**Test scenarios:** *(covered in U3)*

**Verification:**
- TypeScript compiles without errors (`pnpm --filter @mnemos/sdk build`).
- SDK tests pass after U3 updates.

---

- U3. **Update SDK tests for new encryption behavior and `hasAccess`**

**Goal:** Test the new key derivation scheme, version-prefix logic, and `hasAccess()`.

**Requirements:** R1, R2, R6

**Dependencies:** U2

**Files:**
- Modify: `packages/sdk/src/client.spec.ts`

**Approach:**
- Update `snapshot()` tests to verify:
  - `writeContract` is called with `functionName: 'mintMemory'` and `args[1]` (storageUri) starts with `'v2:'`.
  - The `contentHash` in the returned `SnapshotResult` is the keccak256 of the plaintext JSON (not of the encrypted bytes).
- Update `loadMemory()` tests to verify:
  - With a v2 storageUri and correct contentHash: `readContract` is called for `getSnapshot`; `downloadFromStorage` is invoked with the raw uri (without `v2:` prefix); decrypt succeeds and returns the bundle.
  - With a v1 storageUri (no prefix): `downloadFromStorage` receives the uri as-is; falls back to wallet-derived key (decrypt call is made with wallet key, not contentHash key). Since decrypt with wrong key will throw, the test can assert that `loadMemory` throws for v1 tokens when the caller doesn't own the producer wallet — this validates the v1 legacy path distinction.
- Add `hasAccess()` tests:
  - Returns true when `readContract(ownerOf)` returns caller address.
  - Returns true when `readContract(isCurrentRenter)` returns true.
  - Returns false when both checks return non-caller / false.
  - Calls `readContract` with correct ABI function names and args.
- `downloadFromStorage` makes a dynamic import of `@0gfoundation/0g-ts-sdk` — this is not caught by `vi.mock('viem')`. Mock it by adding a `vi.mock('@0gfoundation/0g-ts-sdk', ...)` block in the test file. The mock should expose an `Indexer` class with a `download` method that writes to a provided path (or inject a controllable Uint8Array). Alternatively: test the decrypt round-trip by calling `encrypt(json, key)` → `decrypt(result, key)` via a test-only roundtrip export, or by mocking at a higher level. The key requirement is that tests asserting `readContract` call args for `loadMemory` must be able to reach the chain-read step without the dynamic import blowing up first.

**Patterns to follow:**
- Existing `loadMemory()` test pattern: assert `readContract` was called with correct args, let the decryption throw since storage is not wired.
- `mocks.readContract.mockResolvedValueOnce(...)` for chaining multiple readContract responses in one test.

**Test scenarios:**
- Happy path: `snapshot()` → returned `SnapshotResult.storageUri` starts with `'v2:'`, `contentHash` matches keccak256 of JSON.
- Happy path: `loadMemory(tokenId)` on v2 token → `readContract` called for `getSnapshot`, then `downloadFromStorage` called without `'v2:'` prefix.
- Edge case: `loadMemory` on v1 token (storageUri without `v2:`) → `downloadFromStorage` called with original URI, wallet key used.
- Happy path: `hasAccess(tokenId, ownerAddress)` → `ownerOf` returns ownerAddress → returns `true`.
- Happy path: `hasAccess(tokenId, renterAddress)` → `isCurrentRenter` returns `true` → returns `true`.
- Edge case: `hasAccess(tokenId, randomAddress)` → both checks return false/other-address → returns `false`.

**Verification:**
- `pnpm --filter @mnemos/sdk test` exits 0 with all new tests passing.

---

- U4. **WalletAuthGuard — signature + timestamp verification**

**Goal:** A reusable NestJS guard that verifies EIP-191 wallet signatures and enforces a 5-minute timestamp window.

**Requirements:** R3, R4

**Dependencies:** None (pure auth logic, no chain access)

**Files:**
- Create: `apps/api/src/common/wallet-auth.guard.ts`

**Approach:**
- `@Injectable() WalletAuthGuard implements CanActivate`.
- `canActivate` must return `Promise<boolean>` — it is `async` because `recoverMessageAddress` is async.
- In `canActivate(ctx: ExecutionContext): Promise<boolean>`:
  1. Extract headers: `x-wallet-address`, `x-wallet-signature`, `x-wallet-timestamp` from the HTTP request.
  2. Extract `tokenId = request.params?.tokenId`. If any header or tokenId is missing or undefined → return `false`.
  3. Reconstruct challenge: `mnemos:access:${tokenId}:${walletAddress}:${timestamp}`.
     - `walletAddress` must be checksummed (EIP-55). Enforce by calling `getAddress(walletAddress)` from viem to normalize before building the challenge and comparison.
     - Document for callers: the consumer must use the **checksummed** (EIP-55) format for their address in both the `X-Wallet-Address` header and the challenge they sign. Wallets using ethers.js v5 (which returns lowercase) must call `ethers.utils.getAddress(addr)` before signing.
  4. `recovered = await recoverMessageAddress({ message: challenge, signature })`.
  5. If `recovered.toLowerCase() !== walletAddress.toLowerCase()` → return `false`.
  6. Check `Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp, 10)) > 300` → return `false`.
  7. Attach `request.walletAddress = recovered`.
  8. Return `true`.
- The guard is **not** global — only applied to `GET /api/memory/:tokenId`. Do not add it to snapshot or info endpoints.
- Import `recoverMessageAddress`, `getAddress` from `viem` (already installed).
- **Note on `@UseGuards`:** Because `recoverMessageAddress` may throw on malformed signatures, wrap step 4 in try/catch and return `false` on any error — do not let the exception propagate to NestJS's error handler.

**Patterns to follow:**
- NestJS guard pattern: `@Injectable() class X implements CanActivate`. No new dependencies needed — viem already imported.
- No module or provider registration needed: the guard uses no DI (no injected services). Instantiated directly via `@UseGuards(new WalletAuthGuard())`.

**Test scenarios:**
- Happy path: valid signature matching address + fresh timestamp → `canActivate` returns `true`, `request.walletAddress` is set.
- Error path: missing `x-wallet-address` header → returns `false`.
- Error path: missing `x-wallet-signature` header → returns `false`.
- Error path: signature signed by different address than header claims → returns `false`.
- Error path: timestamp > 300 seconds in the past → returns `false`.
- Error path: timestamp > 300 seconds in the future → returns `false`.
- Edge case: timestamp exactly at boundary (300s) — define as valid or invalid and test consistently.

**Verification:**
- `pnpm --filter @mnemos/api test` passes. Guard unit tests cover all 7 scenarios above.

---

- U5. **Update MemoryService and MemoryRepository for access control**

**Goal:** `loadMemory` checks on-chain access before serving decrypted bundle.

**Requirements:** R3, R4

**Dependencies:** U2 (`hasAccess` on client), U4 (guard has run and put address on request)

**Files:**
- Modify: `apps/api/src/memory/memory.repository.interface.ts`
- Modify: `apps/api/src/memory/memory.repository.ts`
- Modify: `apps/api/src/memory/memory.service.ts`
- Modify: `apps/api/src/memory/memory.service.spec.ts`

**Approach:**
- `IMemoryRepository.loadMemory(tokenId, callerAddress?: `0x${string}`)` — add optional `callerAddress`.
- `MemoryRepository.loadMemory(tokenId, callerAddress?)`:
  - If `callerAddress` provided: call `this.mnemos.getClient().hasAccess(tokenId, callerAddress)`.
  - If `!hasAccess` → throw `new Error('Access denied')`.
  - Then call `this.mnemos.getClient().loadMemory(tokenId)`.
  - If no `callerAddress` → skip access check (internal use path, e.g., reference agent loading its own tokens).
- `MemoryService.loadMemory(tokenId, callerAddress?)`:
  - Passes `callerAddress` through to repo.
  - Wrap in `try/catch` with `handleChainError`. Add check: if error message includes `'Access denied'` → throw `ForbiddenException` (NestJS 403), not `InternalServerErrorException`.
  - Update `handleChainError` to recognize `'Access denied'` message → OR handle it in `MemoryService.loadMemory` before calling `handleChainError`.

**Note:** The `handleChainError` utility doesn't currently handle `ForbiddenException`. Add the access denial check in `MemoryService.loadMemory` directly (before the `handleChainError` catch-all), not inside `handleChainError` — access denial is domain logic, not a chain error.

**Patterns to follow:**
- `marketplace.repository.ts` `fork()` method — pattern for multi-step SDK calls in a repository method.
- `handleChainError` usage in all service methods — wrap with `try/catch`, call `handleChainError` in catch.

**Test scenarios:**
- Happy path: `loadMemory(tokenId, authorizedAddress)` → repo calls `hasAccess` → returns true → loads and returns bundle.
- Error path: `loadMemory(tokenId, unauthorizedAddress)` → `hasAccess` returns false → service throws `ForbiddenException`.
- Happy path: `loadMemory(tokenId)` without callerAddress → skips access check → loads bundle directly (internal use).
- Integration: `repo.loadMemory(tokenId, callerAddress)` calls `getClient().hasAccess()` then `getClient().loadMemory()` in sequence.

**Verification:**
- `pnpm --filter @mnemos/api test` passes with updated service and repo tests.

---

- U6. **Update MemoryController for auth guard + header passing**

**Goal:** `GET /api/memory/:tokenId` enforces wallet auth and passes caller address to service.

**Requirements:** R3, R4

**Dependencies:** U4, U5

**Files:**
- Modify: `apps/api/src/memory/memory.controller.ts`
- Modify: `apps/api/src/memory/memory.controller.spec.ts`

**Approach:**
- Add `@UseGuards(WalletAuthGuard)` to the `loadMemory` handler only (not to snapshot or info).
- Extract `callerAddress` from `@Req() request` (the guard attaches `request.walletAddress`).
- Call `this.memory.loadMemory(BigInt(tokenId), request.walletAddress)`.
- In the Swagger `@ApiResponse`, add `401`/`403` responses for this endpoint.

**Controller test update:**
- The mock NestJS app doesn't run guards by default — tests bypass the guard and test controller→service wiring only.
- Add a new test: `GET /api/memory/:tokenId` without auth headers → the real guard would return 403, but in mock app the guard is not wired. Instead, simulate by having the mock service throw a `ForbiddenException` and asserting the response is 403.
- Add a test that confirms the controller passes `walletAddress` from `request` to `service.loadMemory`.
- For end-to-end guard testing, the guard spec (U4) covers auth logic; controller spec covers wiring.

**Patterns to follow:**
- Existing controller test: `buildApp()` pattern, `request(app.getHttpServer())`.
- NestJS guard decorator: `import { UseGuards } from '@nestjs/common'`.

**Test scenarios:**
- Happy path: mock service returns bundle → controller returns 200 with bundle.
- Error path: mock service throws `ForbiddenException` → controller returns 403.
- Integration: controller calls `service.loadMemory(3n, 'walletAddress from request')` — verify the second argument.

**Verification:**
- `pnpm --filter @mnemos/api test` passes with all controller tests.
- All API tests: `pnpm api:test` (or equivalent) green.

---

## System-Wide Impact

- **`loadMemory()` signature change (optional arg):** Existing callers (reference agent, API) that call without `callerAddress` continue to work unchanged — arg is optional.
- **contentHash semantic change:** Tokens minted after this change store `keccak256(plaintext)` in `contentHash`. Tokens minted before store `keccak256(encrypted)`. Both are valid on-chain. `v2:` prefix in storageUri is the discriminator.
- **`encrypt()`/`decrypt()` now take explicit key:** Only called from `snapshot()` and `loadMemory()` inside `client.ts` — both private, no external callers. No downstream breakage.
- **`deriveSymmetricKey` renamed to `deriveWalletKey`:** Private method, no external callers.
- **ABI additions (`ownerOf`, `isCurrentRenter`):** Additive — existing ABI entries unchanged. These two entries are needed for `hasAccess()`. Both are view functions, no gas implications.
- **No contract change:** `mintMemory(bytes32, string)` and `getSnapshot(uint256)` signatures unchanged.
- **`SnapshotResult.storageUri` now contains `v2:` prefix:** Callers of `snapshot()` and `GET /api/memory/snapshot` will receive `storageUri: "v2:0g://rootHash"` instead of `"0g://rootHash"`. Any frontend or consumer parsing this field by checking for `"0g://"` prefix will break. The Swagger example in `memory.controller.ts` must be updated. Treat this as a **breaking change** to the `SnapshotResult` shape for external callers.
- **`GET /api/memory/:tokenId` now requires auth headers:** Returns 403 without valid `X-Wallet-Address`, `X-Wallet-Timestamp`, `X-Wallet-Signature` headers. Previously returned the bundle with no auth.

---

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| NaCl secretbox requires exactly 32-byte key; `keccak256` output is exactly 32 bytes | `hexToBytes('0x' + 64 hex chars)` = 32 bytes. Verified by type — no nonce-size error expected. |
| v2 key is on-chain: anyone can derive and decrypt — no cryptographic confidentiality | Documented explicitly in Overview. Do not pitch as "private" without TEE caveat. |
| `keccak256(toHex(decodeUTF8(json)))` — `decodeUTF8` naming inversion (`tweetnacl-util`) is counterintuitive | Comment at call site: `decodeUTF8` = string → Uint8Array (naming inverted vs intuition). Pattern already used in `encrypt()` at `client.ts:315`. |
| Address casing in challenge: EIP-55 checksummed vs lowercase causes signature mismatch | Guard normalizes via `getAddress()` from viem before building challenge. Consumer documentation must state: use checksummed (EIP-55) address format in the `X-Wallet-Address` header and the signed challenge. |
| `ownerOf` reverts for non-existent tokens → `hasAccess()` throws instead of returning false | Use `Promise.allSettled` — each rejected result is treated as "access denied" (returns `false`), not a crash. |
| `recoverMessageAddress` may throw on malformed signature input | Wrap in try/catch inside `canActivate`; return `false` on any error. |
| `SnapshotResult.storageUri` now has `v2:` prefix — callers expecting `0g://` format break | Callers using `storageUri` directly (frontend, reference agent) must strip `v2:` or use the raw 0G URI from inside. Documented in System-Wide Impact. |
| v1 token backward compat: `deriveWalletKey()` is wallet-specific; consumer who isn't creator will fail to decrypt v1 tokens | Intentional: v1 tokens are readable only by producer. v2 tokens are the fix. |
| `downloadFromStorage` dynamic import blocks unit test assertion order | Mock `@0gfoundation/0g-ts-sdk` in vitest via `vi.mock` at module level so dynamic import resolves to a controllable stub. |

---

## Documentation / Operational Notes

- Update `packages/sdk/CLAUDE.md` or `packages/sdk/src/CLAUDE.md` to document the new key scheme and `v2:` URI format.
- Update `apps/api/src/CLAUDE.md` note "Authentication — the API is currently open" to reflect that `GET /api/memory/:tokenId` now requires wallet auth.
- The frontend fork panel copy should be updated to describe the 4-step fork workflow: `loadMemory(parent)` → build bundle → `snapshot()` → `fork()`. This is a frontend change, out of scope for this plan but worth tracking.

---

## Sources & References

- **Origin document:** `docs/brainstorms/2026-05-09-consumer-memory-delivery-requirements.md`
- Contract: `contract/src/MemoryRegistry.sol` (getSnapshot struct order, ownerOf)
- Contract: `contract/src/MemoryMarketplace.sol` (isCurrentRenter)
- SDK: `packages/sdk/src/client.ts` (encrypt/decrypt/deriveSymmetricKey, snapshot, loadMemory)
- SDK types: `packages/sdk/src/types.ts`
- API memory module: `apps/api/src/memory/`
- viem `recoverMessageAddress` — used in guard
- NestJS CanActivate guard interface
