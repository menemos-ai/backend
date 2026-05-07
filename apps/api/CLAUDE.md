# CLAUDE.md — apps/api/

NestJS application. CommonJS output (NestJS default). Runs on port 3001 with global prefix `/api`.

## Build and run

```bash
pnpm api:build    # compile to dist/ via tsc (nest build under the hood)
pnpm api:start    # run compiled output (production)
pnpm api:dev      # watch mode with hot reload
```

Build output lands in `dist/`. The `nest-cli.json` controls source root and entry point.

## Configuration

All config via env vars loaded by `@nestjs/config` (`ConfigModule.forRoot({ isGlobal: true })`). Required vars:

```
AGENT_PRIVATE_KEY     server-side wallet private key (hex, 0x-prefixed)
OG_RPC_URL            0G EVM RPC endpoint
OG_STORAGE_NODE       0G Storage indexer URL
REGISTRY_ADDRESS      deployed MemoryRegistry contract address
MARKETPLACE_ADDRESS   deployed MemoryMarketplace contract address
PORT                  optional, defaults to 3001
```

`ConfigService.getOrThrow` is used for required vars — missing vars throw at startup, not at request time.

## tsconfig

Extends `../../tsconfig.base.json` with NestJS-required overrides: `emitDecoratorMetadata: true`, `experimentalDecorators: true`. These are mandatory for NestJS DI to work — don't remove them.

## Source layout

All application code is under `src/`. See `src/CLAUDE.md` for module-level details.
