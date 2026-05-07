# CLAUDE.md — packages/sdk/

`@mnemos/sdk` is the published library. This is the core deliverable of the backend repo.

## Build

`tsup` bundles both ESM and CJS output plus `.d.ts` type declarations. Config is in `tsup.config.ts`. Run `pnpm sdk:build` from the workspace root (or `pnpm build` inside this package).

Output lands in `dist/`. The `package.json` `exports` field points to it. Do not hand-edit `dist/` — it is fully regenerated on every build.

ESM is the primary output. CJS is included for CommonJS consumers (e.g. older toolchains). The SDK source itself is written as ESM — `.js` extensions on all local imports are required for ESM compatibility.

## Examples

`examples/basic-integration.ts` is the canonical 5-line example. It must stay at 5 lines of meaningful integration code (excluding imports and config). If SDK changes make this example longer, reconsider the API design.

## Versioning

For the hackathon, consumers (the frontend, the reference agent) can pin to a git URL in their `package.json`. When publishing to npm, bump the version in `package.json` here and rebuild — the frontend repo must then update its dependency and reinstall.

## Peer dependencies

`@0glabs/0g-ts-sdk` is a peer dependency, not a direct dependency. Don't bundle it. Callers install it alongside the SDK. This keeps the SDK bundle small and lets callers control the 0G SDK version.

## tsconfig

Extends `../../tsconfig.base.json`. Only SDK-specific overrides go in the local `tsconfig.json`. `moduleResolution: bundler` is intentional — tsup handles resolution, not tsc.
