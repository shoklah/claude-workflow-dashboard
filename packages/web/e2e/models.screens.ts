import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

test('the models page matches its screenshot', async ({ page }) => {
  await pinClock(page);
  await page.goto('/models');
  await expect(page.getByRole('rowheader', { name: 'fix-checker' })).toBeVisible();
  await expect(page.getByRole('main')).toHaveScreenshot('models.png');
});
