import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

test('the skills page matches its screenshot', async ({ page }) => {
  await pinClock(page);
  await page.goto('/skills');
  await expect(page.getByRole('row').filter({ hasText: 'subagent-driven-development' })).toBeVisible();
  await expect(page.getByRole('main')).toHaveScreenshot('skills.png');
});
