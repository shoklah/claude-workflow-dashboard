import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

// dev:fixtures' data: report-full, report-later, report-v6 and report-v7, whose sessions and advisors are CR6's.

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

test('the steps and rules page shows each step and rule, summed over the period, and has no axe violations', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Steps and rules' }).click();
  await expect(page.getByRole('heading', { name: 'Steps and rules' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Task review' })).toBeVisible();
  // report-v6's dispatch guard, over the period's runs and sessions: no_model 2, no_simplify 1.
  const guard = page.getByRole('row', { name: /^dispatch guard/ });
  await expect(guard.getByRole('cell', { name: 'no model 2 · no simplify 1' })).toBeVisible();
  await expect(page.getByText('reporter, all time')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
