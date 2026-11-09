import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

test.beforeEach(async ({ page }) => {
  await pinClock(page);
  await page.goto('/');
  await expect(page.getByRole('group', { name: 'Runs this week' })).toBeVisible();
});

test('home has no axe violations', async ({ page }) => {
  await expect(page.getByRole('figure', { name: 'Final review' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

// report-later's new run is on the branch `<img src=x onerror=alert(1)>`: the feed shows it as text.
test('a summary with HTML shows as text', async ({ page }) => {
  const feed = page.getByRole('region', { name: 'Since you last looked' });
  await expect(feed.getByText('<img src=x onerror=alert(1)>')).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
});
