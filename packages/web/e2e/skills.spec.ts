import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

// dev:fixtures' data: report-full, report-later and report-v6, whose typed grill-me was never met in a run and a session.

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

test('the skills page lists the period’s skills with their missing counts and has no axe violations', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Skills' }).click();
  await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: 'subagent-driven-development' });
  await expect(row.getByRole('cell').nth(4)).toHaveText('0');
  const grill = page.getByRole('row').filter({ hasText: 'grill-me' });
  await expect(grill.getByRole('cell').nth(4)).toHaveText('2');
  await expect(page.getByText('reporter, all time')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
