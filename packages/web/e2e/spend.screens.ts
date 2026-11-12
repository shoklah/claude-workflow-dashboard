import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

test('the spend page matches its screenshot', async ({ page }) => {
  await pinClock(page);
  await page.goto('/spend');
  await expect(page.getByRole('region', { name: 'Spend by phase' })).toBeVisible();
  await expect(page.getByRole('img', { name: /: bars by week/ })).toBeVisible();
  await expect(page.getByRole('main')).toHaveScreenshot('spend.png');
});
