import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

// dev:fixtures' data: report-full, report-later and report-v5; this week holds report-v5's plan, two Full and one Small
// run.

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

test('the weeks page shows its small multiples and weekly sums and has no axe violations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Weeks' }).click();
  const thisWeek = page.getByRole('table', { name: 'Weeks' }).getByRole('row').nth(1);
  await expect(thisWeek.getByRole('rowheader')).toHaveText('Nov 8');
  await expect(thisWeek.getByRole('cell').first()).toHaveText('small 1 · full 2 · plan 1');
  await expect(page.getByRole('img', { name: /: bars by week/ })).toHaveCount(4);
  await expect(page.getByRole('table', { name: 'Full runs' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
