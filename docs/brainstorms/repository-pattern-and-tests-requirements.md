# Requirements: Repository Pattern + Test Suite

**Date:** 2026-05-07
**Scope:** Standard
**Status:** Ready for planning

---

## Problem Statement

The API layer (`apps/api/`) has zero test coverage and its services call the SDK client directly. This makes services untestable in isolation and couples business logic to chain I/O. The SDK itself (`packages/sdk/`) also has no tests. Before adding more features, these structural gaps need to be closed.

---

## Goals

1. Introduce a repository pattern in the API so services are decoupled from the SDK client and are independently testable.
2. Add a full test suite for every API endpoint using Jest + Supertest.
3. Add a test suite for the SDK using Vitest with viem fully mocked.
4. Close two missing API surface gaps found during the scan: `payRoyalty` endpoint and a health check.

---

## Non-Goals

- Browser compatibility for the SDK.
- Integration tests against a live chain or local anvil (out of scope for this iteration).
- Authentication or rate limiting on the API.
- Retry logic or circuit breakers.

---

## Scope

### 1. Repository Pattern (API)

Introduce a repository layer between services and the SDK client. Services must not call `mnemos.getClient()` directly — they inject a repository interface instead.

**New files:**
- `apps/api/src/marketplace/marketplace.repository.ts`
- `apps/api/src/marketplace/marketplace.repository.interface.ts`
- `apps/api/src/memory/memory.repository.ts`
- `apps/api/src/memory/memory.repository.interface.ts`

**Updated files:**
- `apps/api/src/marketplace/marketplace.service.ts` — inject `IMarketplaceRepository`
- `apps/api/src/marketplace/marketplace.module.ts` — provide repository
- `apps/api/src/memory/memory.service.ts` — inject `IMemoryRepository`
- `apps/api/src/memory/memory.module.ts` — provide repository

**Repository responsibilities:**
- `MarketplaceRepository` — wraps: `getListing`, `list`, `buy`, `rent`, `fork`, `payRoyalty`
- `MemoryRepository` — wraps: `snapshot`, `getMemoryInfo`, `loadMemory`

Repositories inject `MnemosService` and delegate directly to the SDK client. No logic lives in repositories — they are thin adapters. Logic (e.g. bigint→string conversion) lives in services.

Each repository implements its interface. Tests inject the interface, never the concrete class.

### 2. Missing API Endpoints

Two gaps found in the scan:

**`POST /api/marketplace/royalty/:tokenId`**
- Body: `{ amount: string }` (bigint as string, in wei)
- Calls `payRoyalty(tokenId, amount)` on the SDK
- Returns `{ txHash: string }`
- Add `PayRoyaltyDto` in `apps/api/src/marketplace/dto/pay-royalty.dto.ts`

**`GET /api/health`**
- Returns `{ status: "ok", timestamp: number }`
- No module required — add directly in `main.ts` or a dedicated `HealthController`
- Used by monitoring and by test suite setup to verify the app started

### 3. Error Handling

Services should wrap SDK errors in NestJS `HttpException` so the API returns structured JSON errors instead of 500 stack traces.

Rules:
- Wrap all repository calls in `try/catch`.
- If the error message contains "not found" or is a viem `ContractFunctionRevertedError`, throw `NotFoundException` (404).
- All other errors throw `InternalServerErrorException` (500).
- Log the original error before re-throwing.

### 4. API Test Suite

**Test runner:** Jest + `@nestjs/testing` + Supertest.

**Test structure:**
```
apps/api/src/
  marketplace/
    marketplace.controller.spec.ts   (Supertest E2E against TestingModule)
    marketplace.service.spec.ts      (unit, mocks IMarketplaceRepository)
  memory/
    memory.controller.spec.ts        (Supertest E2E against TestingModule)
    memory.service.spec.ts           (unit, mocks IMemoryRepository)
```

**Controller tests (Supertest):**
Each controller test boots a `TestingModule` with the real controller + real service + mocked repository. Supertest sends HTTP requests against this in-process app — no network, no chain.

Endpoints to cover:

| Endpoint | Happy path | Error case |
|---|---|---|
| `GET /api/marketplace/listings/:tokenId` | 200 + listing object | 404 if repository throws NotFoundException |
| `POST /api/marketplace/list` | 201 + txHash | 400 if DTO invalid |
| `POST /api/marketplace/buy/:tokenId` | 201 + txHash | 500 on chain error |
| `POST /api/marketplace/rent/:tokenId` | 201 + txHash | 400 if durationDays missing |
| `POST /api/marketplace/fork/:tokenId` | 201 + txHash | — |
| `POST /api/marketplace/royalty/:tokenId` | 201 + txHash | 400 if amount missing |
| `POST /api/memory/snapshot` | 201 + SnapshotResult | 400 if DTO invalid |
| `GET /api/memory/:tokenId/info` | 200 + MemoryInfo | 404 on not found |
| `GET /api/memory/:tokenId` | 200 + MemoryBundle | — |
| `GET /api/health` | 200 + `{ status: "ok" }` | — |

**Service unit tests:**
Each service test injects a jest-mocked repository. Tests verify the service performs the correct bigint/string conversions and calls the right repository method.

### 5. SDK Test Suite

**Test runner:** Vitest (ESM-native; Jest has poor ESM support and the SDK is `"type": "module"`).

**Test file:** `packages/sdk/src/client.spec.ts`

**Mocking strategy:** Use `vi.mock('viem')` to mock `createWalletClient` and `createPublicClient`. The mocked wallet client exposes `writeContract` and the mocked public client exposes `readContract` and `waitForTransactionReceipt` as jest spy functions. The `uploadToStorage` and `downloadFromStorage` private methods are accessed via `vi.spyOn` on the class prototype.

**Test cases:**

*Encryption (pure logic, no chain):*
- `encrypt → decrypt` round-trip: data in = data out
- Decryption with tampered ciphertext throws `'Decryption failed'`
- Two calls to `encrypt` with the same data produce different bytes (nonce is random)

*`snapshot()`:*
- Calls `uploadToStorage` with the encrypted bundle bytes
- Calls `writeContract` with `mintRoot` function name, correct `contentHash`, `storageUri`, and `parent = 0n` when no parentTokenId given
- Calls `writeContract` with `parent = parentTokenId` when parentTokenId is provided
- Calls `waitForTransactionReceipt` with the returned txHash
- Returns a `SnapshotResult` with `tokenId`, `contentHash`, `storageUri`, `txHash`, `timestamp`

*`loadMemory()`:*
- Calls `readContract` with `getMemoryInfo` to get `storageUri`
- Calls `downloadFromStorage` with the retrieved `storageUri`
- Returns the decrypted bundle (mocked `downloadFromStorage` returns the result of `encrypt(bundle)`)

*`list()`:*
- Calls `writeContract` with `list` function name and all 7 args from `ListingTerms`
- Returns the txHash

*`buy()`:*
- Calls `readContract` to get listing price first
- Calls `writeContract` with `buy` function and `value: price`

*`rent()`:*
- Calls `readContract` to get `rentalPricePerDay`
- Calls `writeContract` with `value = rentalPricePerDay * BigInt(durationDays)`

*`fork()`:*
- Calls `writeContract` with `fork` function name

*`payRoyalty()`:*
- Calls `writeContract` with `payRoyalty` function and `value: amount`

*`getListing()`:*
- Calls `readContract` with `getListing` function name
- Returns object with all 7 fields, bigints as bigint

*`getMemoryInfo()`:*
- Calls `readContract` with `getMemoryInfo` function name
- Returns object with all 5 fields

*`autoSnapshot()`:*
- `buildBundle` is called once per interval tick
- `onSnapshot` is called with the `SnapshotResult` after a successful snapshot
- `onError` is called (not thrown) when `snapshot` rejects
- Calling the returned unsubscribe function stops the interval (no further calls after unsubscribe)
- Uses `vi.useFakeTimers()` to control `setInterval`

---

## Test Infrastructure

### API (Jest)

Add to `apps/api/package.json`:
```json
"@nestjs/testing": "^10.3.0",
"supertest": "^7.0.0",
"@types/supertest": "^6.0.0",
"jest": "^29.0.0",
"ts-jest": "^29.0.0",
"@types/jest": "^29.5.0"
```

Add `jest.config.js` to `apps/api/` with `ts-jest` preset and `testEnvironment: 'node'`.

Add `test` script to `apps/api/package.json`: `"test": "jest"`.

Add `test:api` script to root `package.json`: `"test:api": "pnpm --filter @mnemos/api test"`.

### SDK (Vitest)

Add to `packages/sdk/package.json` devDependencies:
```json
"vitest": "^1.6.0"
```

Add `test` script to `packages/sdk/package.json`: `"test": "vitest run"`.

Add `test:sdk` script to root `package.json`: `"test:sdk": "pnpm --filter @mnemos/sdk test"`.

Add root `test` script: `"test": "pnpm test:sdk && pnpm test:api"`.

---

## Success Criteria

- `pnpm test:sdk` passes with all SDK cases green.
- `pnpm test:api` passes with all API controller and service tests green.
- Every public API endpoint has at minimum one happy-path test and one error-path test.
- Every public SDK method has at minimum one test.
- No test touches a real chain, real RPC, or real storage node.
- Services contain zero references to `mnemos.getClient()` — all chain access goes through repositories.

---

## Deferred

- Integration tests against anvil (v2, post-hackathon).
- Snapshot/load round-trip test with real 0G Storage (blocked on stub removal).
- Test coverage thresholds enforced in CI.
