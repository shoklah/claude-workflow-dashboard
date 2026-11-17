import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

// The whole rail: brand, menu and its foot; the pages beside it get their own screenshots. 900 px tall so the menu doesn't scroll.
test('the rail', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await pinClock(page);
  await page.goto('/');
  await expect(page.getByRole('complementary')).toHaveScreenshot('rail.png');
});
