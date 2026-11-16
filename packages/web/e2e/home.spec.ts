import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';
import { settled } from './settled.ts';

test.beforeEach(async ({ page }) => {
  await pinClock(page);
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'This week' })).toBeVisible();
});

test('home has no axe violations', async ({ page }) => {
  await expect(page.getByRole('figure', { name: 'Final review' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

// The workflow's paths are a switch of pressed-state buttons, not tabs; the Small path's boxes still pass axe.
test('the path switch shows the Small path', async ({ page }) => {
  await expect(page.getByRole('tab')).toHaveCount(0);
  const small = page.getByRole('button', { name: 'Small path' });
  await small.click();
  await expect(small).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Full path' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('figure', { name: 'Plan review' })).toHaveCount(0);
  await settled(page.getByRole('group', { name: 'Path' }));
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

// report-later's new run is on the branch `<img src=x onerror=alert(1)>`: the feed shows it as text, and no warning
// shows the log's "WARN:" prefix.
test('a summary with HTML shows as text', async ({ page }) => {
  const feed = page.getByRole('region', { name: 'Since you last looked', exact: true });
  await expect(feed.getByText('<img src=x onerror=alert(1)>')).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await expect(feed).not.toContainText('WARN:');
});
