import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

test('the steps and rules page matches its screenshot', async ({ page }) => {
  await pinClock(page);
  await page.goto('/steps');
  await expect(page.getByRole('rowheader', { name: 'Task review' })).toBeVisible();
  await expect(page.getByRole('main')).toHaveScreenshot('steps.png');
});
