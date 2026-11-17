import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

// dev:fixtures' data: report-v6's lantern-notes transcript "Offline sync plan" holds the plan run and the tidepool-api
// feature/webhooks run, with two /grill-me commands whose skill never loaded.

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

test('a session opens its timeline, links its runs and has no axe violations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Work' }).click();
  await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Sessions' }).click();
  await expect(page).toHaveURL(/\/work\?view=sessions$/);
  const toggle = page.getByRole('button', { name: 'Offline sync plan' });
  await expect(toggle).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await toggle.click();
  const timeline = page.getByRole('table', { name: 'Timeline of Offline sync plan' });
  await expect(timeline.locator('tbody tr')).toHaveCount(6);
  await expect(timeline.getByText('Its skill never loaded')).toHaveCount(2);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await timeline.getByRole('link', { name: 'Send webhooks for note changes' }).click();
  await expect(page.getByRole('heading', { name: 'Send webhooks for note changes', level: 1 })).toBeVisible();
});
