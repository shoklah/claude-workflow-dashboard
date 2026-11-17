import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

// The whole rail: brand, menu and its foot, once its import time and showing mode have loaded; the pages beside it get
// their own screenshots. 900 px tall so the menu doesn't scroll.
test('the rail', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await pinClock(page);
  await page.goto('/');
  const rail = page.getByRole('complementary');
  await expect(rail.locator('time')).toBeVisible();
  await expect(rail.getByRole('switch', { name: 'Showing mode' })).toBeEnabled();
  await expect(rail).toHaveScreenshot('rail.png');
});
