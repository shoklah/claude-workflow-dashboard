import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

test('the findings page matches its screenshot', async ({ page }) => {
  await pinClock(page);
  await page.goto('/findings');
  await expect(page.getByRole('rowheader', { name: 'Correctness' })).toBeVisible();
  await expect(page.getByRole('main')).toHaveScreenshot('findings.png');
});
