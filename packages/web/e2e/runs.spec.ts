import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { pinClock } from './fixed-time.ts';
import { settled } from './settled.ts';

// dev:fixtures' data: report-full, then report-later, which adds a Small run whose branch is HTML, then report-v6
// and report-v7, which adds each unit's context.
const HTML_TEXT = '<img src=x onerror=alert(1)>';

/** Opens the Runs list, then the Full run of feature/offline-sync from it. */
async function openFullRun(page: Page): Promise<void> {
  await page.goto('/runs');
  const row = page.getByRole('row').filter({ hasText: 'feature/offline-sync' }).filter({ hasText: 'full' });
  await row.getByRole('link').click();
  await expect(page.getByRole('heading', { name: 'feature/offline-sync', level: 1 })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

test('runs list and run page have no axe violations', async ({ page }) => {
  await page.goto('/runs');
  await expect(page.getByRole('link', { name: /feature\/offline-sync/ }).first()).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await openFullRun(page);
  await page.getByRole('group', { name: 'Task 1' }).getByText('Task review').click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole('button', { name: 'Findings', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await settled(page.getByRole('group', { name: 'View' }));
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('a branch with HTML shows as text', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });

  // The Runs list, in its default period.
  await page.goto('/runs');
  await expect(page.getByRole('link', { name: `lantern-notes · ${HTML_TEXT}` })).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);

  // That run's page.
  await page.getByRole('link', { name: `lantern-notes · ${HTML_TEXT}` }).click();
  await expect(page.getByRole('heading', { name: HTML_TEXT, level: 1 })).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);

  // A finding's summary on the Full run, in the timeline and in the findings table.
  await openFullRun(page);
  await page.getByRole('group', { name: 'Task 2' }).getByText(/Task review/).click();
  await expect(page.getByText(HTML_TEXT)).toBeVisible();
  await page.getByRole('button', { name: 'Findings', exact: true }).click();
  await expect(page.getByRole('cell', { name: HTML_TEXT })).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  expect(dialogs).toEqual([]);
});

test('the toggle switches between timeline and findings', async ({ page }) => {
  await openFullRun(page);
  await expect(page.getByText('Started')).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);

  await page.getByRole('button', { name: 'Findings', exact: true }).click();
  await expect(page.getByRole('row')).toHaveCount(13);
  await expect(page.getByText('Started')).toHaveCount(0);

  await page.getByRole('button', { name: 'Timeline', exact: true }).click();
  await expect(page.getByText('Started')).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('the schema 5 run page lists its strengths under the findings table', async ({ page }) => {
  await page.goto('/runs');
  await page.getByRole('link', { name: 'tidepool-api · feature/webhooks' }).click();
  await expect(page.getByRole('heading', { name: 'feature/webhooks', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Findings', exact: true }).click();
  const strengths = page.getByRole('region', { name: 'Strengths', exact: true });
  await expect(strengths.getByRole('listitem')).toHaveCount(2);
  await expect(strengths.getByText('Each retry delay has its own test')).toBeVisible();
  await expect(strengths.getByText('The signing secret never reaches a log')).toBeVisible();
  await settled(page.getByRole('group', { name: 'View' }));
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
