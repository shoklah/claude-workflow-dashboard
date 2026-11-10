import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

// dev:fixtures' data: report-full, report-later and report-v5, the last one's totals giving the reporter's figures.

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

test('the models page lists the period’s models, marks the reporter’s figures and has no axe violations', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Models and advisor' }).click();
  await expect(page.getByRole('heading', { name: 'Models and advisor', level: 1 })).toBeVisible();
  const checker = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'fix-checker' }) });
  await expect(checker.getByRole('cell')).toHaveText(['opus/medium 1', 'claude-opus-5-5/high 1', '1']);
  await expect(page.getByRole('row').filter({ hasText: 'trial' }).getByRole('cell')).toHaveText(['runs 2/5, weeks 1/3']);
  await expect(page.getByText('reporter, all time').first()).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
