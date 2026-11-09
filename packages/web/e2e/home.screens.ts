import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

test('home matches its screenshot', async ({ page }) => {
  await pinClock(page);
  await page.goto('/');
  await expect(page.getByRole('figure', { name: 'Final review' })).toBeVisible();
  await expect(page.getByRole('main')).toHaveScreenshot('home.png');
});
