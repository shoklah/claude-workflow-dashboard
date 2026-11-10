import { defineConfig } from '@playwright/test';

// Not 4317, so a real dashboard running on the Mac doesn't clash; E2E_PORT lets parallel worktrees run side by side.
const PORT = Number(process.env.E2E_PORT ?? 4399);

// Two projects against the Hono server on invented data (dev:fixtures, which serves the built web): `checks` (axe and
// behaviour, `*.spec.ts`) runs anywhere; `screens` (screenshot comparisons, `*.screens.ts`) exists only inside the
// Playwright container that `pnpm test:screens` starts, so baselines never depend on the Mac's fonts.
export default defineConfig({
  testDir: 'e2e',
  // One worker: showing mode is server-wide state, so a test that turns it on must not overlap another test.
  workers: 1,
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: 'pnpm build && pnpm --filter @cwd/server dev:fixtures',
    env: { PORT: String(PORT) },
    url: `http://127.0.0.1:${PORT}/api/status`,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'checks', testMatch: /\.spec\.ts$/ },
    ...(process.env.PLAYWRIGHT_SCREENS === '1' ? [{ name: 'screens', testMatch: /\.screens\.ts$/ }] : []),
  ],
});
