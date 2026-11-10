import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

// dev:fixtures' data: report-full, report-later and report-v6, with labels.json's invented labels for the lantern-notes
// Full and plan runs, and the labeller off.

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

test('the findings page lists a cell’s findings, says the labeller is off and has no axe violations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Findings' }).click();
  await expect(page.getByRole('rowheader', { name: 'Correctness' })).toBeVisible();
  await expect(page.getByText('Labeller off: no API key')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // The Full run's Correctness findings, in the week of Nov 8.
  await page.getByRole('button', { name: /^Correctness, week of Nov 8: [1-9]/ }).click();
  const list = page.getByRole('region', { name: 'Findings', exact: true });
  await expect(list.getByText('Retry loop never gives up after the third failure')).toBeVisible();
  await list.getByRole('link', { name: 'lantern-notes · feature/offline-sync' }).first().click();
  await expect(page.getByRole('heading', { name: 'lantern-notes · feature/offline-sync' })).toBeVisible();
});

test('the selected cell’s findings have no axe violations', async ({ page }) => {
  await page.goto('/findings');
  await page.getByRole('button', { name: /^Correctness, week of Nov 8: [1-9]/ }).click();
  await expect(page.getByRole('region', { name: 'Findings', exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('"App differs" is enabled, and the page no longer says every label is the app\'s', async ({ page }) => {
  await page.goto('/findings');
  // report-v6's webhooks run carries the workflow's labels.
  await expect(page.getByRole('rowheader', { name: 'Correctness' })).toBeVisible();
  await expect(page.getByText(/Every label here is the app's/)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const option = page.getByRole('button', { name: 'App differs' });
  await expect(option).toBeEnabled();
  await option.click();
  await expect(option).toHaveAttribute('aria-pressed', 'true');
});
