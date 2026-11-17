import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectLatestWeekWhole } from './charts.ts';
import { pinClock } from './fixed-time.ts';

// dev:fixtures' data: report-full, report-later, report-v6 and report-v7; this week holds report-v6's plan, two Full
// and one Small run.

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

test('the weeks page shows its small multiples and weekly sums and has no axe violations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Weeks' }).click();
  // Two header rows, then the newest week.
  const thisWeek = page.getByRole('region', { name: 'By week table', exact: true }).getByRole('table').getByRole('row').nth(2);
  await expect(thisWeek.getByRole('rowheader')).toHaveText('Nov 8');
  await expect(thisWeek.getByRole('cell').nth(0)).toHaveText('1');
  await expect(thisWeek.getByRole('cell').nth(1)).toHaveText('2');
  await expect(thisWeek.getByRole('cell').nth(2)).toHaveText('1');
  await expect(page.getByRole('img', { name: /: bars by week/ })).toHaveCount(4);
  await expect(page.getByRole('region', { name: 'Full runs, with and without waves table', exact: true }).getByRole('table')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

for (const width of [375, 768]) {
  test(`at ${width} px each chart keeps its latest week label whole`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/weeks');
    const charts = page.getByRole('img', { name: /: bars by week/ });
    await expect(charts).toHaveCount(4);
    // The latest week, as the week table names it in its first body row.
    await expectLatestWeekWhole(
      charts,
      page.getByRole('region', { name: 'By week table', exact: true }).getByRole('row').nth(2).getByRole('rowheader'),
    );
  });
}
