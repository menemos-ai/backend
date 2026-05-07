---
title: "feat: Repository Pattern, Missing Endpoints, and Test Suite"
type: feat
status: active
date: 2026-05-07
origin: docs/brainstorms/repository-pattern-and-tests-requirements.md
---

# feat: Repository Pattern, Missing Endpoints, and Test Suite

## Overview

Introduce a repository abstraction layer in the NestJS API, add two missing endpoints (`payRoyalty` and health check), add structured error handling, and establish a full test suite — Jest + Supertest for the API, Vitest for the SDK. No test touches a real chain or RPC.

---

## Problem Frame

The API services (`MarketplaceService`, `MemoryService`) call `this.mnemos.getClient()` directly in every method. This couples business logic to the chain I/O layer and makes unit testing impossible without mocking `MnemosClient` wholesale. The SDK has no tests. Two endpoint gaps exist: `payRoyalty` is implemented in the SDK but has no API route, and there is no health check. (see origin: docs/brainstorms/repository-pattern-and-tests-requirements.md)

---

## Requirements Trace

- R1. Services must not reference `mnemos.getClient()` — all chain access goes through injected repository interfaces.
- R2. `POST /api/marketplace/royalty/:tokenId` must be reachable, wired to `payRoyalty` on the SDK.
- R3. `GET /api/health` must return `{ status: "ok", timestamp: number }`.
- R4. Services must catch all errors from repositories and re-throw as typed `HttpException` (NotFoundException / InternalServerErrorException). No raw stack traces in API responses.
- R5. `pnpm test:api` runs all API controller + service tests with no chain access.
- R6. `pnpm test:sdk` runs all SDK method tests with viem fully mocked.
- R7. Every public API endpoint has at minimum one happy-path test and one error-path test.
- R8. Every public `MnemosClient` method has at minimum one test.
- R9. No duplicate error-translation logic across services.

---

## Scope Boundaries

- No integration tests against a live chain or local anvil.
- No authentication or rate limiting.
- No retry logic or circuit breakers.
- No browser compatibility changes to the SDK.
- No test coverage thresholds enforced in CI.

### Deferred to Follow-Up Work

- Integration tests against anvil: separate task, post-hackathon.
- Snapshot/load round-trip test with real 0G Storage: blocked on stub removal.
- CI coverage enforcement: separate pipeline task.

---

## Context & Research

### Relevant Code and Patterns

- `apps/api/src/marketplace/marketplace.service.ts` — current coupling pattern to replace
- `apps/api/src/memory/memory.service.ts` — current coupling pattern to replace
- `apps/api/src/mnemos/mnemos.module.ts` — `@Global()` module; repositories get `MnemosService` automatically without explicit import
- `apps/api/src/marketplace/dto/list.dto.ts` — DTO convention: string for bigint fields, `class-validator` decorators
- `packages/sdk/src/client.ts` — `payRoyalty(parentTokenId, amount)` already implemented at line 251; `fork()` is `payable` in ABI but passes no `value` (known gap)

### Institutional Learnings

- No `docs/solutions/` directory exists yet. First entries should be captured after any non-obvious discovery in this work.

### External References

- NestJS custom providers docs: injection tokens required for interface-based DI (interfaces are erased at runtime)
- Vitest docs: `vi.mock` with factory function handles ESM named exports; `vi.useFakeTimers()` controls `setInterval`

---

## Key Technical Decisions

- **Injection tokens as Symbols**: TypeScript interfaces are erased at runtime. Each repository interface file exports a `Symbol` token used for `provide`/`@Inject`. This is the standard NestJS pattern for interface-based DI.
- **Repositories are pure passthroughs**: No bigint/string conversion in repositories. All conversion logic stays in services. This keeps responsibilities clear and avoids double-conversion bugs.
- **Shared chain error utility**: Both `MarketplaceService` and `MemoryService` need identical error-translation logic. Extract to `apps/api/src/common/chain-error.util.ts` to satisfy R9. A single function `handleChainError(error: unknown): never` classifies and re-throws.
- **Health check as HealthModule**: A two-file `HealthController` + `HealthModule` is cleaner than putting route logic in `main.ts` — the Supertest test can boot just `HealthModule` in isolation, and the pattern is consistent with the rest of the API.
- **Test runner split**: Jest for the API (CommonJS, NestJS testing utilities); Vitest for the SDK (ESM-native, avoids Jest's poor ESM support). The SDK is `"type": "module"`.
- **`tweetnacl` in Vitest**: `tweetnacl` ships as CommonJS internally. Vitest's `deps.interopDefault: true` (or `esmExternals: true` depending on version) resolves this without aliasing.
- **`vi.spyOn(client as any, 'uploadToStorage')`**: `uploadToStorage` and `downloadFromStorage` are `private`. Casting to `any` for spying is the correct test-only pattern; do not make them `protected` just for testability.
- **`fork()` value gap**: The SDK `fork()` implementation does not pass `value` to the `payable` ABI function. The test scenario should document this observed behavior (calls `writeContract` with no `value`) as a known issue rather than asserting a correct value. Do not silently fix it during this task.

---

## Open Questions

### Resolved During Planning

- **Interface injection pattern**: Use Symbol tokens, not string literals. Defined in the interface file, co-located with the interface. ✓
- **Where does bigint→string conversion live**: Services only. Repositories are passthroughs. ✓
- **Error handling duplication**: Shared utility function in `apps/api/src/common/`. ✓
- **Test runner for SDK**: Vitest. ✓

### Deferred to Implementation

- **`tweetnacl` CJS/ESM interop**: If `vi.mock` setup fails on `tweetnacl` import, try adding `deps: { interopDefault: true }` in vitest config. Exact setting depends on the vitest version installed.
- **`fork()` payable value**: Whether `fork()` should pass a value must be verified against the actual contract. Deferred — this plan tests the current behavior, not the correct behavior.

---

## Output Structure

```
apps/api/
├── jest.config.js                                  (new)
└── src/
    ├── common/
    │   └── chain-error.util.ts                     (new)
    ├── health/
    │   ├── health.controller.ts                    (new)
    │   └── health.module.ts                        (new)
    ├── marketplace/
    │   ├── dto/
    │   │   └── pay-royalty.dto.ts                  (new)
    │   ├── marketplace.controller.spec.ts          (new)
    │   ├── marketplace.controller.ts               (modified)
    │   ├── marketplace.module.ts                   (modified)
    │   ├── marketplace.repository.interface.ts     (new)
    │   ├── marketplace.repository.ts               (new)
    │   ├── marketplace.service.spec.ts             (new)
    │   └── marketplace.service.ts                  (modified)
    └── memory/
        ├── memory.controller.spec.ts               (new)
        ├── memory.controller.ts                    (modified — minor, no new endpoints)
        ├── memory.module.ts                        (modified)
        ├── memory.repository.interface.ts          (new)
        ├── memory.repository.ts                    (new)
        ├── memory.service.spec.ts                  (new)
        └── memory.service.ts                       (modified)
packages/sdk/
├── vitest.config.ts                                (new)
└── src/
    └── client.spec.ts                              (new)
Root:
├── package.json                                    (modified — test scripts)
└── apps/api/package.json                           (modified — test deps + script)
    packages/sdk/package.json                       (modified — vitest dep + script)
```

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

**Dependency flow after refactor:**

```
Controller
  └─ injects → Service
                 └─ injects → IRepository (via Symbol token)
                               └─ injects → MnemosService
                                             └─ getClient() → MnemosClient → viem / 0G
```

**Error flow:**

```
Repository method → throws (raw SDK / viem error)
  ↓ caught in Service
  ↓ handleChainError(error)  [shared util]
    ├─ "not found" in message || ContractFunctionRevertedError → NotFoundException (404)
    └─ anything else → InternalServerErrorException (500)
  ↓ NestJS exception filter → structured JSON response
```

**Test isolation model:**

```
Controller spec (Supertest):
  TestingModule { Controller + Service + MockRepository }
  ↳ HTTP request via supertest → exercises controller + service + validation

Service spec (Jest unit):
  MockRepository injected directly
  ↳ exercises service logic (bigint conversion, error handling) in isolation
```

---

## Implementation Units

- U1. **Test Infrastructure**

**Goal:** Install all test dependencies and create test runner config for both API (Jest) and SDK (Vitest). Add test scripts to workspace.

**Requirements:** R5, R6

**Dependencies:** None

**Files:**
- Modify: `apps/api/package.json`
- Modify: `packages/sdk/package.json`
- Modify: `package.json`
- Create: `apps/api/jest.config.js`
- Create: `packages/sdk/vitest.config.ts`

**Approach:**
- `apps/api/package.json` devDependencies: add `@nestjs/testing`, `supertest`, `@types/supertest`, `jest`, `ts-jest`, `@types/jest`.
- `packages/sdk/package.json` devDependencies: add `vitest`.
- `apps/api/jest.config.js`: use `ts-jest` preset, `testEnvironment: 'node'`, `roots: ['<rootDir>/src']`, point `ts-jest` globals at the API's `tsconfig.json`.
- `packages/sdk/vitest.config.ts`: minimal — `test.environment: 'node'`, add `deps.interopDefault: true` preemptively for `tweetnacl` CJS interop.
- Root `package.json`: add `"test:sdk"`, `"test:api"`, and `"test"` (runs both sequentially) scripts.
- API `package.json`: add `"test": "jest"` script.
- SDK `package.json`: add `"test": "vitest run"` script.

**Patterns to follow:**
- `apps/api/tsconfig.json` — `ts-jest` must use this tsconfig (has `emitDecoratorMetadata: true`, required for NestJS DI in tests)

**Test scenarios:**
- Test expectation: none — this unit is pure configuration scaffolding. Verify by running `pnpm test:sdk` and `pnpm test:api` and confirming both runners launch (they will have zero test files at this point, which is acceptable).

**Verification:**
- `pnpm test:sdk` exits without error (zero tests is acceptable at this stage).
- `pnpm test:api` exits without error (zero tests is acceptable at this stage).

---

- U2. **Repository Interfaces and Injection Tokens**

**Goal:** Define the `IMarketplaceRepository` and `IMemoryRepository` interfaces and their injection token Symbols. Define the shared chain error utility.

**Requirements:** R1, R4, R9

**Dependencies:** None (no runtime dependency on U1)

**Files:**
- Create: `apps/api/src/marketplace/marketplace.repository.interface.ts`
- Create: `apps/api/src/memory/memory.repository.interface.ts`
- Create: `apps/api/src/common/chain-error.util.ts`

**Approach:**
- `marketplace.repository.interface.ts`: export `IMarketplaceRepository` interface (method signatures matching SDK client: `getListing`, `list`, `buy`, `rent`, `fork`, `payRoyalty` — all taking `bigint` params, returning the same types as `MnemosClient`). Export `MARKETPLACE_REPOSITORY` as a `Symbol('IMarketplaceRepository')` constant from the same file.
- `memory.repository.interface.ts`: export `IMemoryRepository` interface (`snapshot`, `getMemoryInfo`, `loadMemory`). Export `MEMORY_REPOSITORY` Symbol.
- `chain-error.util.ts`: export `handleChainError(error: unknown): never`. Logic: if the error message contains `"not found"` (case-insensitive) or the error is an instance of viem's `ContractFunctionRevertedError`, throw `NotFoundException`. Otherwise throw `InternalServerErrorException`. Log the original error (using `console.error` or NestJS `Logger`) before re-throwing.
- Method signatures in the interfaces must exactly match the SDK client's public types — import from `@mnemos/sdk` types where possible to stay in sync.

**Patterns to follow:**
- `apps/api/src/marketplace/dto/list.dto.ts` — naming and file convention
- `packages/sdk/src/types.ts` — source of truth for return types (`SnapshotResult`, `MemoryInfo`, `ListingTerms`, `MemoryBundle`)

**Test scenarios:**
- Test expectation: none — interfaces are types only (erased at runtime). The chain error utility is tested indirectly through service tests in U6.

**Verification:**
- TypeScript compilation of the API (`pnpm api:build`) succeeds after adding these files.

---

- U3. **Repository Implementations**

**Goal:** Implement `MarketplaceRepository` and `MemoryRepository` as thin adapters that delegate to `MnemosService.getClient()`. Register them in their respective modules.

**Requirements:** R1

**Dependencies:** U2

**Files:**
- Create: `apps/api/src/marketplace/marketplace.repository.ts`
- Modify: `apps/api/src/marketplace/marketplace.module.ts`
- Create: `apps/api/src/memory/memory.repository.ts`
- Modify: `apps/api/src/memory/memory.module.ts`

**Approach:**
- `MarketplaceRepository` implements `IMarketplaceRepository`. It is `@Injectable()`. It injects `MnemosService`. Each method calls `this.mnemos.getClient().<method>` and returns the result directly — no conversion logic.
- `MemoryRepository` follows the same pattern for `snapshot`, `getMemoryInfo`, `loadMemory`.
- `MarketplaceModule`: add `MarketplaceRepository` to `providers` with the injection token: `{ provide: MARKETPLACE_REPOSITORY, useClass: MarketplaceRepository }`.
- `MemoryModule`: same for `{ provide: MEMORY_REPOSITORY, useClass: MemoryRepository }`.
- No need to import `MnemosModule` explicitly — it is `@Global()` and its exports are already in scope.

**Patterns to follow:**
- `apps/api/src/mnemos/mnemos.service.ts` — `@Injectable()` class with constructor injection
- `apps/api/src/marketplace/marketplace.module.ts` — current `providers` array structure

**Test scenarios:**
- Test expectation: none — repositories are pure delegation wrappers with no logic. Correctness verified through service and controller tests in U6.

**Verification:**
- `pnpm api:build` succeeds.
- Application boots without DI errors (`pnpm api:dev` starts cleanly).

---

- U4. **Service Refactor + Error Handling**

**Goal:** Update `MarketplaceService` and `MemoryService` to inject repository interfaces (not `MnemosService` directly) and wrap all repository calls with error handling via `handleChainError`.

**Requirements:** R1, R4, R9

**Dependencies:** U2, U3

**Files:**
- Modify: `apps/api/src/marketplace/marketplace.service.ts`
- Modify: `apps/api/src/memory/memory.service.ts`

**Approach:**
- Replace `constructor(private readonly mnemos: MnemosService)` with `constructor(@Inject(MARKETPLACE_REPOSITORY) private readonly repo: IMarketplaceRepository)` in `MarketplaceService`. Same pattern for `MemoryService`.
- Replace every `this.mnemos.getClient().<method>` call with `this.repo.<method>`.
- Keep all bigint→string conversion logic in services — it does not move.
- Wrap every `await this.repo.*` call in `try/catch`. In the `catch` block, call `handleChainError(error)`. This is the only change to the catch block — no duplication.
- Import `handleChainError` from `apps/api/src/common/chain-error.util.ts`.

**Execution note:** Each service method should be refactored individually. After each method, verify the compile still passes before proceeding to the next — this catches import/type mismatches early.

**Patterns to follow:**
- `apps/api/src/marketplace/marketplace.service.ts` — existing method structure and return type convention (bigint→string)

**Test scenarios:**
- Test expectation: none — this unit has no net-new behavior; correctness is verified by service unit tests in U6 which test the same methods post-refactor.

**Verification:**
- `pnpm api:build` succeeds with zero TypeScript errors.
- No method in either service contains `getClient()`.
- Application boots and responds to existing endpoints identically to before.

---

- U5. **Missing Endpoints: payRoyalty and Health Check**

**Goal:** Add the `POST /api/marketplace/royalty/:tokenId` endpoint and the `GET /api/health` endpoint.

**Requirements:** R2, R3

**Dependencies:** U3, U4

**Files:**
- Create: `apps/api/src/marketplace/dto/pay-royalty.dto.ts`
- Modify: `apps/api/src/marketplace/marketplace.controller.ts`
- Modify: `apps/api/src/marketplace/marketplace.service.ts`
- Modify: `apps/api/src/marketplace/marketplace.repository.interface.ts`
- Modify: `apps/api/src/marketplace/marketplace.repository.ts`
- Create: `apps/api/src/health/health.controller.ts`
- Create: `apps/api/src/health/health.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Approach:**

*payRoyalty:*
- `PayRoyaltyDto`: one field — `@IsString() amount: string`. Matches DTO convention (bigint as string in JSON body).
- `IMarketplaceRepository.payRoyalty(parentTokenId: bigint, amount: bigint)` — add to interface.
- `MarketplaceRepository.payRoyalty` — delegates to `this.mnemos.getClient().payRoyalty(parentTokenId, amount)`.
- `MarketplaceService.payRoyalty(tokenId: bigint, dto: PayRoyaltyDto)` — converts `BigInt(dto.amount)`, calls `this.repo.payRoyalty(tokenId, BigInt(dto.amount))`, returns `{ txHash }`.
- `MarketplaceController`: add `@Post('royalty/:tokenId')` method. Convert `tokenId` param to `BigInt` at controller level, same as other methods.

*Health check:*
- `HealthController`: single `@Get()` method returning `{ status: 'ok', timestamp: Date.now() }`. No service injection needed.
- `HealthModule`: declares `HealthController` in controllers. No providers.
- `AppModule`: import `HealthModule`. The health controller will respond at `GET /api/health` because the global prefix is `api` and the controller prefix is `health`.

**Patterns to follow:**
- `apps/api/src/marketplace/dto/rent.dto.ts` — minimal DTO with `class-validator`
- `apps/api/src/marketplace/marketplace.controller.ts` — `@Post` with `@Param` and `@Body` pattern
- Existing module files for `HealthModule` structure

**Test scenarios:**
- Covered by U6 controller spec tests.

**Verification:**
- `GET /api/health` returns `200` with `{ status: 'ok', timestamp: <number> }`.
- `POST /api/marketplace/royalty/1` with body `{ "amount": "1000000000000000000" }` reaches the service without DTO validation error.
- `POST /api/marketplace/royalty/1` with missing `amount` field returns `400`.

---

- U6. **API Test Suite**

**Goal:** Write Jest + Supertest tests for every API endpoint and every service method.

**Requirements:** R5, R7

**Dependencies:** U1, U4, U5

**Files:**
- Create: `apps/api/src/marketplace/marketplace.controller.spec.ts`
- Create: `apps/api/src/marketplace/marketplace.service.spec.ts`
- Create: `apps/api/src/memory/memory.controller.spec.ts`
- Create: `apps/api/src/memory/memory.service.spec.ts`

**Approach:**

*Controller specs (Supertest pattern):*
Each spec file:
1. Creates a `TestingModule` with the real controller + real service + a mock repository object (plain object implementing the interface).
2. Calls `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))` before initializing so DTO validation fires identically to production.
3. Uses `supertest(app.getHttpServer())` to send HTTP requests.
4. Mock repository methods are `jest.fn()` that return resolved/rejected promises.

*Service specs (unit pattern):*
Each spec file:
1. Instantiates the service directly, injecting a mock repository object with `jest.fn()` methods.
2. Calls service methods directly and asserts on return values and mock call args.

**Test scenarios:**

*marketplace.controller.spec.ts:*
- Happy path: `GET /marketplace/listings/1` → 200, response contains stringified bigint fields (price, rentalPricePerDay)
- Error path: `GET /marketplace/listings/1` → repository throws NotFoundException → response is 404
- Happy path: `POST /marketplace/list` with valid body → 201, `{ txHash: '0x...' }`
- Error path: `POST /marketplace/list` with missing `tokenId` field → 400 (DTO validation)
- Error path: `POST /marketplace/list` with `forkRoyaltyBps > 10000` → 400 (DTO @Max validation)
- Happy path: `POST /marketplace/buy/1` → 201, `{ txHash: '0x...' }`
- Error path: `POST /marketplace/buy/1` → repository throws InternalServerErrorException → 500
- Happy path: `POST /marketplace/rent/1` with `{ "durationDays": 7 }` → 201, `{ txHash: '0x...' }`
- Error path: `POST /marketplace/rent/1` with missing `durationDays` → 400
- Error path: `POST /marketplace/rent/1` with `durationDays: 0` → 400 (`@Min(1)`)
- Happy path: `POST /marketplace/fork/1` → 201, `{ txHash: '0x...' }`
- Happy path: `POST /marketplace/royalty/1` with `{ "amount": "1000000000000000" }` → 201, `{ txHash: '0x...' }`
- Error path: `POST /marketplace/royalty/1` with missing `amount` → 400
- Happy path: `GET /health` (via HealthModule registered separately) → 200, `{ status: 'ok', timestamp: <number> }`

*marketplace.service.spec.ts:*
- `getListing`: calls `repo.getListing(1n)` and converts returned bigints (price, rentalPricePerDay) to strings in the response object
- `list`: converts DTO string fields to bigint before calling `repo.list(tokenId, { price: bigint, ... })`
- `buy`: calls `repo.buy(tokenId)`, returns `{ txHash }`
- `rent`: calls `repo.rent(tokenId, durationDays)`, returns `{ txHash }`
- `fork`: calls `repo.fork(tokenId)`, returns `{ txHash }`
- `payRoyalty`: converts `dto.amount` to bigint before calling `repo.payRoyalty`
- Error propagation: when repo throws any error, `handleChainError` reclassifies it correctly — "not found" text → NotFoundException, generic error → InternalServerErrorException

*memory.controller.spec.ts:*
- Happy path: `POST /memory/snapshot` with valid `{ data: {}, metadata: { category: 'trading' } }` → 201, response has stringified `tokenId`
- Error path: `POST /memory/snapshot` with missing `metadata` → 400
- Error path: `POST /memory/snapshot` with invalid `metadata` (not an object) → 400
- Happy path: `GET /memory/1/info` → 200, all bigint fields returned as strings
- Error path: `GET /memory/1/info` → repository throws NotFoundException → 404
- Happy path: `GET /memory/1` → 200, MemoryBundle object returned

*memory.service.spec.ts:*
- `snapshot`: converts `dto.parentTokenId` string to bigint when present; calls `repo.snapshot` with correct bundle; converts `tokenId` and `timestamp` to strings in response
- `snapshot`: omits `parentTokenId` (undefined) when not present in DTO
- `getMemoryInfo`: calls `repo.getMemoryInfo(tokenId)`, converts all bigint fields (tokenId, parent, timestamp) to strings
- `loadMemory`: calls `repo.loadMemory(tokenId)`, returns the raw MemoryBundle

**Patterns to follow:**
- `apps/api/src/marketplace/marketplace.module.ts` — for `TestingModule` setup; use `overrideProvider(MARKETPLACE_REPOSITORY)` with `useValue`

**Verification:**
- `pnpm test:api` passes with all scenarios green.
- Zero tests are skipped or pending.

---

- U7. **SDK Test Suite**

**Goal:** Write a Vitest test file covering every public `MnemosClient` method with viem fully mocked.

**Requirements:** R6, R8

**Dependencies:** U1

**Files:**
- Create: `packages/sdk/src/client.spec.ts`

**Approach:**

At the top of the test file:
- `vi.mock('viem')` with a factory that returns mock implementations of `createWalletClient` and `createPublicClient`.
- The mocked wallet client is a plain object with `writeContract` as `vi.fn()`.
- The mocked public client is a plain object with `readContract` as `vi.fn()` and `waitForTransactionReceipt` as `vi.fn()`.
- `createWalletClient` and `createPublicClient` return these mock client objects.

For `uploadToStorage`/`downloadFromStorage`: use `vi.spyOn(client as any, 'uploadToStorage')` and `vi.spyOn(client as any, 'downloadFromStorage')` after construction.

For `autoSnapshot`: use `vi.useFakeTimers()` in `beforeEach` and `vi.useRealTimers()` in `afterEach`.

Each test group creates a fresh `MnemosClient` instance with a test private key and stub addresses.

**Test scenarios:**

*Encryption (pure logic):*
- Happy path: call `snapshot` with a bundle, then call `loadMemory` with a mock that returns the same encrypted bytes from `uploadToStorage` — the bundle data is recovered identically
- Edge case: `downloadFromStorage` returns tampered bytes → `loadMemory` throws `'Decryption failed'`
- Edge case: call `snapshot` twice with the same bundle — the `storageUri` bytes differ (nonce is random, so the encrypted payload is different each call)

*`snapshot()`:*
- Happy path: `uploadToStorage` is called with a `Uint8Array` (encrypted data)
- Happy path: `writeContract` is called with `functionName: 'mintRoot'`, `args` containing correct `contentHash`, `storageUri`, and `parent: 0n` when no `parentTokenId` given
- Happy path: `writeContract` is called with `args[2] === parentTokenId` when a parent is provided
- Happy path: `waitForTransactionReceipt` is called with the hash returned by `writeContract`
- Happy path: returns a `SnapshotResult` with `tokenId`, `contentHash`, `storageUri`, `txHash`, `timestamp` all populated
- Edge case: `waitForTransactionReceipt` returns a receipt with no matching log → `tokenId` is `0n`

*`loadMemory()`:*
- Happy path: `readContract` is called with `functionName: 'getMemoryInfo'` and the correct `tokenId`
- Happy path: `downloadFromStorage` is called with the `storageUri` from the `getMemoryInfo` result
- Happy path: returns the decrypted `MemoryBundle` matching the original data

*`list()`:*
- Happy path: `writeContract` called with `functionName: 'list'` and all 7 args from `ListingTerms` in correct order
- Happy path: returns the txHash string from `writeContract`

*`buy()`:*
- Happy path: `readContract` called with `functionName: 'getListing'` first to get price
- Happy path: `writeContract` called with `functionName: 'buy'`, `value: listing.price`

*`rent()`:*
- Happy path: `readContract` called with `functionName: 'getListing'` first
- Happy path: `writeContract` called with `value: rentalPricePerDay * BigInt(durationDays)`

*`fork()`:*
- Happy path: `writeContract` called with `functionName: 'fork'`
- Known issue: `writeContract` is called with no `value` even though the ABI marks it `payable` — assert this observed behavior and add a comment flagging the gap

*`payRoyalty()`:*
- Happy path: `writeContract` called with `functionName: 'payRoyalty'`, `value: amount`

*`getListing()`:*
- Happy path: `readContract` called with `functionName: 'getListing'`
- Happy path: all 7 return fields present with correct types (bigints as bigint, booleans as boolean)

*`getMemoryInfo()`:*
- Happy path: `readContract` called with `functionName: 'getMemoryInfo'`
- Happy path: all 5 return fields present; `tokenId`, `parent`, `timestamp` are bigint

*`autoSnapshot()`:*
- Happy path: after advancing fake timer by `intervalMs`, `buildBundle` is called once
- Happy path: after `buildBundle` resolves, `onSnapshot` is called with the `SnapshotResult`
- Error path: when `snapshot` rejects, `onError` is called with the error — process does not crash, timer keeps running
- Unsubscribe: calling the returned stop function then advancing the timer does not trigger `buildBundle` again
- Edge case: `onError` is not called when `snapshot` succeeds

**Patterns to follow:**
- `packages/sdk/src/client.ts` — method signatures and return types to test against

**Verification:**
- `pnpm test:sdk` passes with all scenarios green.
- Zero tests are skipped or pending.
- No test imports from a real RPC, chain, or `@0glabs/0g-ts-sdk`.

---

## System-Wide Impact

- **Interaction graph:** No middleware or observers are affected. `ValidationPipe` is global and already covers new DTOs automatically.
- **Error propagation:** After U4, raw viem errors no longer surface to API callers. `handleChainError` is the single choke point — if the classification logic changes, it changes in one place.
- **State lifecycle risks:** None. No database. All state is on-chain.
- **API surface parity:** The frontend (`mnemos-frontend`) calls the API but only reads from it for listings. The new `payRoyalty` endpoint is additive. Health check is additive. No breaking changes.
- **Integration coverage:** Controller specs exercise the full controller → service → mock-repository stack. The DI token wiring (Symbol-based injection) is exercised by the `TestingModule` boot, which will fail fast if the token/provider binding is incorrect.
- **Unchanged invariants:** `MnemosClient` remains a singleton managed by `MnemosService`. Repositories do not construct their own client. The `autoSnapshot` public contract (returns unsubscribe function) is unchanged.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `tweetnacl` CJS/ESM conflict in Vitest | Add `deps: { interopDefault: true }` to `vitest.config.ts` pre-emptively. If it still fails, alias `tweetnacl` to its CJS entry in the vitest config. |
| Symbol injection token not found at runtime | Ensure both the `provide` and `@Inject()` reference the same exported Symbol constant. Test by booting `TestingModule` in the first controller spec — DI failure shows immediately. |
| `fork()` payable value gap surfaces as test failure | Test asserts the observed behavior (no value), adds a `// TODO` comment. Does not block the suite. |
| ts-jest transpilation mismatch for decorator metadata | Point `ts-jest` at `apps/api/tsconfig.json` (has `emitDecoratorMetadata: true`). If using a separate `tsconfig.test.json`, copy those flags. |

---

## Documentation / Operational Notes

- Update `apps/api/CLAUDE.md` to document the repository pattern and injection token convention — so the next person adding an endpoint knows to add a repository method too.
- Update root `package.json` scripts table in README or CLAUDE.md to mention `pnpm test`.

---

## Sources & References

- **Origin document:** [docs/brainstorms/repository-pattern-and-tests-requirements.md](docs/brainstorms/repository-pattern-and-tests-requirements.md)
- Related code: `apps/api/src/marketplace/marketplace.service.ts`, `apps/api/src/memory/memory.service.ts`
- Related code: `packages/sdk/src/client.ts` (payRoyalty at line 251, fork gap)
- External docs: NestJS custom providers — https://docs.nestjs.com/fundamentals/custom-providers
- External docs: Vitest mocking — https://vitest.dev/guide/mocking
