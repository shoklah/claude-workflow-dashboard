import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';
import { settled } from './settled.ts';

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

test('the spend page shows the groups, opens one to its phases and has no axe violations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Spend' }).click();
  await expect(page.getByRole('heading', { name: 'Spend', level: 1 })).toBeVisible();
  await expect(page.getByRole('img', { name: /: bars by week/ })).toBeVisible();
  const table = page.getByRole('region', { name: 'Spend by phase', exact: true });
  for (const group of ['All phases', 'Plan', 'Implement', 'Review and cleanup', 'Coordination', 'Unattributed']) {
    await expect(table.getByRole('row').filter({ hasText: group })).not.toHaveCount(0);
  }

  const plan = table.getByRole('button', { name: 'Plan' });
  await expect(plan).toHaveAttribute('aria-expanded', 'false');
  await plan.click();
  await expect(plan).toHaveAttribute('aria-expanded', 'true');
  await expect(table.getByRole('cell', { name: 'Design', exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  const total = table.getByRole('row').filter({ hasText: 'All phases' }).getByRole('cell').nth(1);
  const all = await total.textContent();
  const count = page.getByRole('group', { name: 'Count' });
  await count.getByRole('button', { name: 'Sessions' }).click();
  await expect(total).not.toHaveText(all ?? '');
  await settled(count);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("at 375 px the chart's legend doesn't overlap its week labels", async ({ page }) => {
  // Sized before loading, as the shell's check does: a chart resizes a moment after the window does.
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/spend');
  const chart = page.getByRole('img', { name: /: bars by week/ });
  await expect(chart).toBeVisible();
  // The weeks and the groups, as the chart's table view names them.
  await page.getByText('The chart as a table').click();
  const weekly = page.getByRole('region', { name: 'Weekly spend' });
  const weeks = await weekly.getByRole('rowheader').allTextContents();
  const groups = (await weekly.getByRole('columnheader').allTextContents()).slice(1, -2).map((h) => h.replace(/ \(\$\)$/, ''));
  // Each named text's box, read in one pass over the chart's texts.
  const boxes = (names: string[]) =>
    chart.locator('svg text').evaluateAll(
      (texts, names) =>
        texts
          .filter((text) => names.includes(text.textContent ?? ''))
          .map((text) => {
            const { x, y, width, height } = text.getBoundingClientRect();
            return { x, y, width, height };
          }),
      names,
    );
  const labels = await boxes(weeks);
  const legend = await boxes(groups);
  expect(labels.length).toBeGreaterThan(0);
  expect(legend).toHaveLength(groups.length);
  const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  for (const item of legend) for (const label of labels) expect(overlaps(item, label)).toBe(false);
});
