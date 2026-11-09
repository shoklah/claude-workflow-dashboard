import type { Page } from '@playwright/test';

/** dev:fixtures' clock: pinned in the browser too, so relative times and screenshots don't drift. */
export const NOW = new Date('2026-11-12T12:00:00Z');

export async function pinClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(NOW);
}
