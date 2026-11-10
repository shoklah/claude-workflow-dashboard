import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

test('the compliance page matches its screenshot', async ({ page }) => {
  await pinClock(page);
  await page.goto('/compliance');
  await page.getByRole('button', { name: 'step has no agent id, week of Nov 8: 1' }).click();
  await expect(page.getByRole('list', { name: 'Warnings' })).toBeVisible();
  await expect(page.getByRole('main')).toHaveScreenshot('compliance.png');
});
