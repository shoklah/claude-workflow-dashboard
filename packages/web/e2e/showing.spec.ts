import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { pinClock } from './fixed-time.ts';
import { settled } from './settled.ts';

// dev:fixtures' data has two projects, lantern-notes and tidepool-api; showing mode here shows lantern-notes only.
// The mode is server state, so Playwright runs one worker and every test here stops it afterwards.
const SESSION_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Fails if the page's text holds a session ID. */
async function expectNoSessionId(page: Page): Promise<void> {
  expect(await page.locator('body').innerText()).not.toMatch(SESSION_ID);
}

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

test.afterEach(async ({ request }) => {
  const response = await request.post('/api/showing', {
    data: { projects: [] },
    headers: { 'X-Dashboard-Refresh': '1' },
  });
  expect(response.status()).toBe(204);
});

test('showing lantern-notes hides tidepool-api from the pages', async ({ page }) => {
  const tidepoolRows = page.getByRole('row').filter({ hasText: /tidepool-api|fix\/retry-backoff/ });
  await page.goto('/runs');
  await expect(tidepoolRows).toHaveCount(2);

  await page.getByRole('switch', { name: 'Showing mode' }).click();
  const dialog = page.getByRole('dialog', { name: 'Show which projects in full?' });
  await dialog.getByRole('checkbox', { name: 'lantern-notes' }).check();
  // The dialog fades in: axe waits for it.
  await settled(dialog);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await dialog.getByRole('button', { name: 'Start showing' }).click();
  await expect(page.getByRole('complementary').getByText('Showing: lantern-notes')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // Runs: no tidepool-api row, and the line counting the runs it hides.
  await expect(page.getByText(/in other projects, counted in totals and charts only/)).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'lantern-notes' }).first()).toBeVisible();
  await expect(tidepoolRows).toHaveCount(0);
  await expectNoSessionId(page);

  // Home: the feed holds no tidepool-api item.
  await page.goto('/');
  await expect(page.getByRole('complementary').getByText('Showing: lantern-notes')).toBeVisible();
  const feed = page.getByRole('region', { name: 'Since you last looked', exact: true });
  await expect(feed.getByText(/lantern-notes/).first()).toBeVisible();
  await expect(feed.getByText(/tidepool-api/)).toHaveCount(0);
  await expectNoSessionId(page);
});

test('in a short window the brand and the foot stay and the menu scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto('/runs');
  const rail = page.getByRole('complementary');
  await rail.getByRole('switch', { name: 'Showing mode' }).click();
  const dialog = page.getByRole('dialog', { name: 'Show which projects in full?' });
  await dialog.getByRole('checkbox', { name: 'lantern-notes' }).check();
  await dialog.getByRole('button', { name: 'Start showing' }).click();
  await expect(rail.getByText('Showing: lantern-notes')).toBeInViewport();
  await expect(rail.getByRole('button', { name: 'Stop showing' })).toBeInViewport();
  await expect(rail.getByRole('button', { name: 'Refresh' })).toBeInViewport();
  await expect(rail.getByText('edward', { exact: true })).toBeInViewport();
  const last = rail.getByRole('link', { name: 'Models and advisor' });
  await expect(last).not.toBeInViewport();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  await expect(rail.getByRole('button', { name: 'Refresh' })).toBeInViewport();
  // The rail never grows past the window: the page isn't made taller to fit it.
  expect(Math.round((await rail.boundingBox())!.height)).toBe(600 - 24);
});
