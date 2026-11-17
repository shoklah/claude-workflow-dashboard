import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

test('the runs list matches its screenshot', async ({ page }) => {
  await page.goto('/runs');
  await expect(page.getByRole('link', { name: /feature\/offline-sync/ }).first()).toBeVisible();
  await expect(page.getByRole('main')).toHaveScreenshot('runs.png');
});

test('the run page matches its screenshot', async ({ page }) => {
  await page.goto('/runs');
  const row = page.getByRole('row').filter({ hasText: 'feature/offline-sync' }).filter({ hasText: 'Full' });
  await row.getByRole('link').click();
  await expect(page.getByRole('group', { name: "The run's flow" })).toBeVisible();
  await expect(page.getByRole('main')).toHaveScreenshot('run.png');
});

test("the run page with a step selected matches its screenshot", async ({ page }) => {
  await page.goto('/runs');
  const row = page.getByRole('row').filter({ hasText: 'feature/offline-sync' }).filter({ hasText: 'Full' });
  await row.getByRole('link').click();
  const check = page.getByRole('group', { name: "The run's flow" }).getByRole('button', { name: /^Wave A check/ });
  await check.click();
  await expect(page.getByRole('region', { name: 'Wave A check', exact: true })).toBeVisible();
  await expect(page.getByRole('main')).toHaveScreenshot('run-step.png');
});
