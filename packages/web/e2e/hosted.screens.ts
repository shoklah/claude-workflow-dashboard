import { expect, test } from '@playwright/test';
import { HOSTED_URL } from '../playwright.config.ts';
import { pinClock } from './fixed-time.ts';

test.use({ baseURL: HOSTED_URL });

for (const [name, path] of [['signin', '/signin'], ['signin-refused', '/signin?error=refused']]) {
  for (const width of [1440, 375]) {
    test(`${path} at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await pinClock(page);
      await page.goto(path);
      await expect(page.getByRole('link', { name: 'Sign in with GitHub' })).toBeVisible();
      await expect(page).toHaveScreenshot(`${name}-${width}.png`);
    });
  }
}
