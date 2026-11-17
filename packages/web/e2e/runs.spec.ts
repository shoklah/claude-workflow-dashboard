import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

// dev:fixtures' data: report-full, then report-later, which adds a Small run whose branch is HTML, then report-v6
// and report-v7, which adds each unit's context.
const HTML_TEXT = '<img src=x onerror=alert(1)>';

/** Opens the Runs list, then the Full run of feature/offline-sync from it. */
async function openFullRun(page: Page): Promise<void> {
  await page.goto('/runs');
  const row = page.getByRole('row').filter({ hasText: 'feature/offline-sync' }).filter({ hasText: 'Full' });
  await row.getByRole('link').click();
  await expect(page.getByRole('heading', { name: 'feature/offline-sync', level: 1 })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

test('runs list and run page have no axe violations', async ({ page }) => {
  await page.goto('/runs');
  await expect(page.getByRole('link', { name: /feature\/offline-sync/ }).first()).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await openFullRun(page);
  const task1 = page.getByRole('group', { name: "The run's flow" }).getByRole('button', { name: /^Task 1(?!\d)/ });
  await task1.click();
  await expect(task1).toHaveAttribute('aria-pressed', 'true');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("the Full run's page has no sideways scroll at 375 px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openFullRun(page);
  await expect(page.getByRole('group', { name: "The run's flow" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("each run's row names its branch as the link to its page", async ({ page }) => {
  await page.goto('/runs');
  const row = page.getByRole('row').filter({ hasText: 'feature/webhooks' });
  await expect(row.getByRole('cell').nth(1)).toHaveText('tidepool-api');
  await expect(row.getByRole('cell').nth(2)).toHaveText('Full');
  await row.getByRole('link', { name: 'feature/webhooks' }).click();
  await expect(page).toHaveURL(/\/runs\/[0-9a-f]{16}$/);
  await expect(page.getByRole('heading', { name: 'feature/webhooks', level: 1 })).toBeVisible();
});

test('a branch with HTML shows as text', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });

  // The Runs list, in its default period.
  await page.goto('/runs');
  await expect(page.getByRole('link', { name: HTML_TEXT })).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);

  // That run's page.
  await page.getByRole('link', { name: HTML_TEXT }).click();
  await expect(page.getByRole('heading', { name: HTML_TEXT, level: 1 })).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);

  // A finding's summary on the Full run, in the findings table.
  await openFullRun(page);
  await expect(page.getByRole('cell', { name: HTML_TEXT })).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  expect(dialogs).toEqual([]);
});

test('the schema 5 run page lists its strengths under the findings table', async ({ page }) => {
  await page.goto('/runs');
  await page.getByRole('link', { name: 'feature/webhooks' }).click();
  await expect(page.getByRole('heading', { name: 'feature/webhooks', level: 1 })).toBeVisible();
  const strengths = page.getByRole('region', { name: 'Strengths', exact: true });
  await expect(strengths.getByRole('listitem')).toHaveCount(2);
  await expect(strengths.getByText('Each retry delay has its own test')).toBeVisible();
  await expect(strengths.getByText('The signing secret never reaches a log')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
