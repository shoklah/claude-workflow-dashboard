import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';
import { settled } from './settled.ts';

// dev:fixtures' data ends on report-v7, whose lantern-notes feature/offline-sync Full run has the most calls past the
// cap.

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

test('the context page lists the units over the cap, links their runs and has no axe violations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Context' }).click();
  await expect(page.getByRole('heading', { name: 'Context', level: 1 })).toBeVisible();
  await expect(page.getByRole('img', { name: /: bars by week/ })).toHaveCount(5);
  const units = page.getByRole('region', { name: 'Runs and sessions', exact: true }).getByRole('row');
  const first = units.nth(2).getByRole('link', { name: 'feature/offline-sync' });
  await expect(first).toBeVisible();
  const overCap = await units.count();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await first.click();
  await expect(page.getByRole('heading', { name: 'feature/offline-sync', level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Context', exact: true })).toBeVisible();

  await page.goBack();
  const show = page.getByRole('group', { name: 'Show' });
  await show.getByRole('button', { name: 'All' }).click();
  await expect.poll(() => units.count()).toBeGreaterThan(overCap);
  await settled(show);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('at 375 px each chart keeps its latest week label whole', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/context');
  const charts = page.getByRole('img', { name: /: bars by week/ });
  await expect(charts).toHaveCount(5);
  // The latest week, as the charts' table view names it in its first row.
  await page.getByText('The charts as a table').click();
  const latest = await page
    .getByRole('region', { name: 'Weekly context' })
    .getByRole('row')
    .nth(2)
    .getByRole('rowheader')
    .textContent();
  for (const chart of await charts.all()) {
    const box = (await chart.boundingBox())!;
    const label = chart.locator('svg text', { hasText: new RegExp(`^${latest}$`) });
    await expect(label).toHaveCount(1);
    const labelBox = (await label.boundingBox())!;
    expect(labelBox.x).toBeGreaterThanOrEqual(box.x);
    expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(box.x + box.width);
  }
});
