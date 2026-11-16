import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

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
  const first = units.nth(1).getByRole('link', { name: 'lantern-notes · feature/offline-sync · full' });
  await expect(first).toBeVisible();
  const overCap = await units.count();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await first.click();
  await expect(page.getByRole('heading', { name: 'feature/offline-sync', level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Context', exact: true })).toBeVisible();

  await page.goBack();
  await page.getByRole('group', { name: 'Units' }).getByRole('button', { name: 'All' }).click();
  await expect.poll(() => units.count()).toBeGreaterThan(overCap);
});
