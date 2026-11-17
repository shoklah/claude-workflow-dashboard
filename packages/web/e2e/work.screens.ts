import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

test('the Work page matches its screenshot', async ({ page }) => {
  await pinClock(page);
  await page.goto('/work');
  await expect(page.getByRole('region', { name: 'Offline sync', exact: true })).toBeVisible();
  await expect(page.getByRole('main')).toHaveScreenshot('work.png');
});
