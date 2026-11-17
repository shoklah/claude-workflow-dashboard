import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

test('the findings page matches its screenshot', async ({ page }) => {
  await pinClock(page);
  await page.goto('/findings');
  await expect(page.getByRole('rowheader', { name: 'Correctness' })).toBeVisible();
  // A selected cell, so the findings list is on screen.
  await page.getByRole('button', { name: 'Correctness, week of Nov 8: 3' }).click();
  await expect(page.getByRole('region', { name: 'Findings', exact: true })).toBeVisible();
  await expect(page.getByRole('main')).toHaveScreenshot('findings.png');
});
