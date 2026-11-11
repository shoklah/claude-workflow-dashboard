import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

test('the spend page shows the groups, opens one to its phases and has no axe violations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Spend' }).click();
  await expect(page.getByRole('heading', { name: 'Spend', level: 1 })).toBeVisible();
  await expect(page.getByRole('img', { name: /: bars by week/ })).toBeVisible();
  const table = page.getByRole('region', { name: 'Spend by phase' });
  for (const group of ['Plan', 'Implement', 'Review and cleanup', 'Coordination', 'Unattributed']) {
    await expect(table.getByRole('row').filter({ hasText: group })).not.toHaveCount(0);
  }

  const plan = table.getByRole('button', { name: 'Plan' });
  await expect(plan).toHaveAttribute('aria-expanded', 'false');
  await plan.click();
  await expect(plan).toHaveAttribute('aria-expanded', 'true');
  await expect(table.getByRole('cell', { name: 'design', exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  const total = table.getByRole('row').filter({ hasText: 'Total' }).getByRole('cell').nth(1);
  const all = await total.textContent();
  await page.getByRole('group', { name: 'Units' }).getByRole('button', { name: 'Sessions' }).click();
  await expect(total).not.toHaveText(all ?? '');
});
