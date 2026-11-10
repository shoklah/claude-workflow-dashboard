import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

// dev:fixtures' data: report-full, report-later and report-v5; report-v5's totals are the last good import's.

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

test('the steps and rules page shows each step and rule, marks the reporter’s figures and has no axe violations', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Steps and rules' }).click();
  await expect(page.getByRole('heading', { name: 'Steps and rules' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Task review' })).toBeVisible();
  // report-v5's dispatch guard: no_model 1, no_simplify 1.
  const guard = page.getByRole('row', { name: /^dispatch guard/ });
  await expect(guard.getByText('reporter, all time')).toBeVisible();
  await expect(guard.getByRole('cell', { name: 'no model 1 · no simplify 1' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
