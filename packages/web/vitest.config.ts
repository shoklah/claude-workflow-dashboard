import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { searchForWorkspaceRoot } from 'vite';
import { defineConfig, mergeConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import viteConfig from './vite.config.ts';

// The web package's tests, in Playwright's chromium: `stories` runs every story as a test (its play function is the
// interaction test), `unit` the `*.test.tsx` files (hooks). The e2e folder is Playwright's own, run by `playwright test`.
export default mergeConfig(
  viteConfig,
  defineConfig({
    // Vite's default (the workspace root) plus the real folder of the root's node_modules, so a checkout whose
    // node_modules is a link to another one (the failing-test check's temp copy) can still serve the test setup files.
    server: {
      fs: {
        allow: [
          searchForWorkspaceRoot(process.cwd()),
          realpathSync(fileURLToPath(new URL('../../node_modules', import.meta.url))),
        ],
      },
    },
    test: {
      name: 'web',
      browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' }] },
      projects: [
        // An absolute configDir, since the root config runs this project from the repo root.
        { plugins: [storybookTest({ configDir: fileURLToPath(new URL('.storybook', import.meta.url)) })], test: { name: 'stories' } },
        { test: { name: 'unit', include: ['src/**/*.test.{ts,tsx}'] } },
      ],
    },
  }),
);
