import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

// dev:fixtures' data: report-full, report-later and report-v5, the last one's totals giving each skill's missing count.

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

test('the skills page lists the period’s skills, marks the reporter’s figure and has no axe violations', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Skills' }).click();
  await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: 'subagent-driven-development' });
  await expect(row.getByRole('cell').nth(4)).toHaveText('0');
  await expect(page.getByText('reporter, all time')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
