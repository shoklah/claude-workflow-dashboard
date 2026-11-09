import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

// The menu only: the page beside it changes as Tasks 9 and 10 build the screens, which get their own screenshots.
test('the menu', async ({ page }) => {
  await pinClock(page);
  await page.goto('/');
  await expect(page.getByRole('navigation')).toHaveScreenshot('menu.png');
});
