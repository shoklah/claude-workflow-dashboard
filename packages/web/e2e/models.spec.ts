import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

// dev:fixtures' data: report-full, report-later, report-v6 and report-v7, the last one's totals giving the reporter's
// figures.

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

test('the models page lists the period’s models, marks the reporter’s figures and has no axe violations', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Models and advisor' }).click();
  await expect(page.getByRole('heading', { name: 'Models and advisor', level: 1 })).toBeVisible();
  // One value per cell, models in the reader's words: requested model, effort, dispatches, then what it ran on.
  const checker = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'fix-checker' }) });
  await expect(checker.getByRole('cell')).toHaveText(['Opus', 'medium', '1', 'Opus 5.5', 'high', '1', '1']);
  const period = page.getByRole('region', { name: 'This period' });
  await expect(period.getByText('runs 2/5, weeks 1/3')).toBeVisible();
  await expect(period.getByText('reporter, all time')).toBeVisible();
  // The advisor's calls over the period's runs and sessions, by role as the reporter sorts them.
  const roles = page.getByRole('region', { name: 'Advisor calls by role' });
  await expect(roles.getByRole('rowheader')).toHaveText(['implementer', 'main', 'task-reviewer']);
  await expect(roles.getByRole('row').filter({ hasText: 'task-reviewer' }).getByRole('cell')).toHaveText(['1', 'no']);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
