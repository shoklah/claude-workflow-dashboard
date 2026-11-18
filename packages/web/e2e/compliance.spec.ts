import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';
import { settled } from './settled.ts';

// dev:fixtures' data: report-full, report-later, report-v6 and report-v7, whose warnings carry their kinds and steps;
// the webhooks run's final review has no agent id.

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

test('the compliance page lists a cell’s warnings with their run and has no axe violations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Compliance' }).click();
  await expect(page.getByRole('heading', { name: 'Compliance' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Steps and the record' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  const cell = page.getByRole('button', { name: 'Step has no agent id, week of Nov 8: 1' });
  await cell.click();
  const table = page.getByRole('region', { name: 'Warnings', exact: true });
  await expect(table.getByText('final_review step 1 has no agent id')).toBeVisible();
  await expect(table.getByText(/WARN:/)).toHaveCount(0);
  await settled(cell);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // report-v7's information lines, below the warnings, each as a term and its value.
  const information = page.getByRole('region', { name: 'Information from the reporter' });
  await expect(information.getByRole('term').filter({ hasText: /^inline sweeps$/ })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await table.getByRole('link', { name: 'Send webhooks for note changes' }).click();
  await expect(page.getByRole('heading', { name: 'Send webhooks for note changes', level: 1 })).toBeVisible();
});

test('home’s orange final review box opens compliance filtered to that step', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('figure', { name: 'Final review' }).getByRole('link', { name: '1 warning on Final review' }).click();
  await expect(page).toHaveURL(/\/compliance\?step=final_review$/);
  await expect(page.getByText('Step: Final review')).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Step has no agent id' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Simplify record differs' })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // A step change starts the page afresh: the selection made under the step doesn't stay.
  await page.getByRole('button', { name: 'Step has no agent id, week of Nov 8: 1' }).click();
  await expect(page.getByRole('region', { name: 'Warnings', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Clear the step filter' }).click();
  await expect(page).toHaveURL(/\/compliance$/);
  await expect(page.getByRole('rowheader', { name: 'Simplify record differs' })).toBeVisible();
  await expect(page.getByText('Select a cell to list its warnings.')).toBeVisible();
});
