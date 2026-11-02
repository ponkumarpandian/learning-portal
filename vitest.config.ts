import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Node 22.4+ ships its own global localStorage, which shadows jsdom's and warns about a missing
// --localstorage-file. Turn it off in test workers so the jsdom Storage is the one under test.
const nodeWebStorageOff = process.allowedNodeEnvironmentFlags.has('--no-experimental-webstorage')
  ? ['--no-experimental-webstorage']
  : [];

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      execArgv: nodeWebStorageOff,
      include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
      coverage: { include: ['src/engine/**'], thresholds: { lines: 90 } },
    },
  }),
);
