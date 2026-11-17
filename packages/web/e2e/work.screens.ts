import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

test('the Work page matches its screenshot', async ({ page }) => {
  await pinClock(page);
  await page.goto('/work');
  await expect(page.getByRole('region', { name: 'Offline sync', exact: true })).toBeVisible();
  await expect(page.getByRole('main')).toHaveScreenshot('work.png');
});

test("a change's page matches its screenshot", async ({ page }) => {
  await pinClock(page);
  await page.goto('/work/changes/6acb252ca65f81f8');
  await expect(page.getByRole('region', { name: 'Sessions of this change, as a graph' })).toBeVisible();
  await expect(page.getByRole('main')).toHaveScreenshot('change.png');
});
