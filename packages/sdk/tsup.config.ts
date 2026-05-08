import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    platform: 'node',
    noExternal: ['tweetnacl', 'tweetnacl-util'],
  },
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
    dts: false,
    clean: false,
    sourcemap: true,
    platform: 'node',
    noExternal: ['tweetnacl', 'tweetnacl-util'],
  },
]);
