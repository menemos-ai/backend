# CLAUDE.md — apps/api/src/

NestJS REST API. Stateless — all state lives on chain. The API wraps SDK calls so the frontend doesn't need to hold a private key.

## Module layout

```
src/
├── main.ts               bootstrap: ValidationPipe, CORS, global prefix /api, port 3001
├── app.module.ts         root module, imports all three feature modules
├── mnemos/               @Global singleton — provides MnemosClient to all modules
├── marketplace/          GET/POST for listing, buy, rent, fork
└── memory/               POST snapshot, GET info, GET load
```

## MnemosModule (mnemos/)

`MnemosService` is a `@Global` provider that wraps `MnemosClient`. All other services inject it via `MnemosService`, never by constructing `MnemosClient` directly. `MnemosClient` is initialised in `onModuleInit` (not the constructor) because it reads env vars via `ConfigService`, which requires the DI container to be ready.

If you need to call the SDK from a new module, inject `MnemosService` and call `.getClient()`. Do not import `MnemosClient` directly in feature modules.

## bigint serialization

JSON doesn't support `bigint`. Every service method that returns chain data must convert `bigint` fields to `string` before returning. This applies to: `tokenId`, `price`, `rentalPricePerDay`, `parent`, `timestamp`. The pattern is `value.toString()`.

Incoming token IDs arrive as URL params (strings). Convert with `BigInt(tokenId)` at the controller level before passing to the service.

## Validation

DTOs use `class-validator` decorators. `ValidationPipe({ whitelist: true, transform: true })` is applied globally. `whitelist: true` strips unknown properties — don't pass extra fields and expect them to survive. `transform: true` auto-coerces primitive types (e.g. string → number for `@IsInt()` params).

Price and token ID fields in DTOs are `string` (not `bigint`) because JSON doesn't carry bigint — convert to `bigint` inside the service, never in the DTO.

## Adding a new endpoint

1. Add a method to the relevant service (call `this.mnemos.getClient().<method>`).
2. Add the route to the controller with the correct HTTP verb.
3. If there's a request body, add a DTO class in the `dto/` subdirectory next to the module.
4. Serialize bigint → string in the service return value.

## What the API does NOT handle

- User-signed transactions (buy, rent require the user's own wallet via wagmi in the frontend).
- Authentication — the API is currently open. Rate limiting and auth are out of hackathon scope.
- Caching — responses come directly from chain reads on each request.
