import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

test('the sessions page, a session open, matches its screenshot', async ({ page }) => {
  await pinClock(page);
  await page.goto('/sessions');
  await page.getByRole('button', { name: 'Offline sync plan' }).click();
  await expect(page.getByRole('list', { name: 'Timeline of Offline sync plan' })).toBeVisible();
  await expect(page.getByRole('main')).toHaveScreenshot('sessions.png');
});
