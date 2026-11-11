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
  const checker = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'fix-checker' }) });
  await expect(checker.getByRole('cell')).toHaveText(['opus/medium 1', 'claude-opus-5-5/high 1', '1']);
  const trial = page.getByRole('row').filter({ hasText: 'trial' });
  await expect(trial.getByRole('cell')).toHaveText(['runs 2/5, weeks 1/3']);
  await expect(trial.getByText('reporter, all time')).toBeVisible();
  // The advisor's facts over the period's runs and sessions, by role as the reporter sorts them.
  const roles = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'calls by role' }) });
  await expect(roles.getByRole('cell')).toHaveText(['implementer 2 · main 7 · task-reviewer 1 (should not consult)']);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
