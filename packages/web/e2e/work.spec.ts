import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

// dev:fixtures' data: report-work's goals, each a section of the Changes view.

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

test('the Changes view has no axe violations, and a goal section opens and closes', async ({ page }) => {
  await page.goto('/work');
  await expect(page.getByRole('heading', { name: 'Work', level: 1 })).toBeVisible();
  const toggle = page.getByRole('region', { name: 'Offline sync', exact: true }).getByRole('button', { name: 'Offline sync' });
  await expect(toggle).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  const open = (await toggle.getAttribute('aria-expanded')) === 'true';
  const table = page.getByRole('region', { name: 'Offline sync table' });
  await expect(table).toHaveCount(open ? 1 : 0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', String(!open));
  await expect(table).toHaveCount(open ? 0 : 1);
  await toggle.click();
  await expect(table).toHaveCount(open ? 1 : 0);
  if (!open) await toggle.click();
  await expect(table).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
