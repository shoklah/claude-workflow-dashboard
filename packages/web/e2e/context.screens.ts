import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

test('the context page matches its screenshot', async ({ page }) => {
  await pinClock(page);
  await page.goto('/context');
  await expect(page.getByRole('region', { name: 'Runs and sessions' })).toBeVisible();
  await expect(page.getByRole('img', { name: /: bars by week/ })).toHaveCount(5);
  await expect(page.getByRole('main')).toHaveScreenshot('context.png');
});
