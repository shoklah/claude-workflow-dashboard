import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

test('the weeks page matches its screenshot', async ({ page }) => {
  await pinClock(page);
  await page.goto('/weeks');
  await expect(page.getByRole('table', { name: 'Full runs' })).toBeVisible();
  await expect(page.getByRole('img', { name: /: bars by week/ })).toHaveCount(4);
  await expect(page.getByRole('main')).toHaveScreenshot('weeks.png');
});
