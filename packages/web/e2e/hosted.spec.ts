import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { HOSTED_URL } from '../playwright.config.ts';
import { pinClock } from './fixed-time.ts';
import { settled } from './settled.ts';

// Hosted mode's dev:fixtures, whose stub GitHub signs in at once as rowan-k.
test.use({ baseURL: HOSTED_URL });

test('a page without a session lands on the sign-in page', async ({ page }) => {
  await pinClock(page);
  await page.goto('/work');
  await expect(page).toHaveURL(`${HOSTED_URL}/signin`);
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
});

for (const path of ['/signin', '/signin?error=refused']) {
  test(`${path} has no axe violations`, async ({ page }) => {
    await pinClock(page);
    await page.goto(path);
    await expect(page.getByRole('link', { name: 'Sign in with GitHub' })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations).toEqual([]);
  });
}

test('signing in lands on Home, with the login in the rail and no Refresh', async ({ page }) => {
  await pinClock(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/signin');
  await page.getByRole('link', { name: 'Sign in with GitHub' }).click();
  await expect(page).toHaveURL(`${HOSTED_URL}/`);
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
  const rail = page.getByRole('complementary');
  await expect(rail.getByRole('link', { name: 'rowan-k' })).toHaveAttribute('href', '/account');
  await expect(rail.locator('time')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh' })).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);
});

test('at 375 px the Menu dialog ends with the login', async ({ page }) => {
  await pinClock(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/signin');
  await page.getByRole('link', { name: 'Sign in with GitHub' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Menu' }).click();
  const dialog = page.getByRole('dialog');
  await settled(dialog);
  await expect(dialog.getByRole('link', { name: 'rowan-k' })).toHaveAttribute('href', '/account');
  const { violations } = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(violations).toEqual([]);
});

/** Signs in through the stub GitHub and opens the Account page from the rail. */
async function openAccount(page: Page) {
  await pinClock(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/signin');
  await page.getByRole('link', { name: 'Sign in with GitHub' }).click();
  await page.getByRole('complementary').getByRole('link', { name: 'rowan-k' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Account' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Collector', exact: true })).toBeVisible();
}

test('/account: a token created shows once and adds a row, and revoking it removes the row', async ({ page }) => {
  await openAccount(page);
  await page.waitForLoadState('networkidle');
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations).toEqual([]);

  const collector = page.getByRole('region', { name: 'Collector', exact: true });
  const revoke = collector.getByRole('button', { name: 'Revoke' });
  await expect(revoke).toHaveCount(0);
  await collector.getByRole('button', { name: 'Create token' }).click();
  const dialog = page.getByRole('dialog', { name: 'Collector token' });
  await settled(dialog);
  await expect(dialog.getByText(/^EDWARD_TOKEN=ed_[\w-]{43}$/)).toBeVisible();
  const dialogAxe = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(dialogAxe.violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(revoke).toHaveCount(1);
  await revoke.click();
  await expect(revoke).toHaveCount(0);
  await expect(collector.getByText('No tokens. Create one for your collector.')).toBeVisible();
});

test('/account: setting a key shows Set, and removing it brings the field back', async ({ page }) => {
  await openAccount(page);
  const labeller = page.getByRole('region', { name: 'Labeller', exact: true });
  await labeller.getByLabel('Anthropic key').fill('sk-ant-invented-e2e');
  await labeller.getByRole('button', { name: 'Save' }).click();
  await expect(labeller.getByText('Set', { exact: true })).toBeVisible();
  await expect(labeller.getByText('No key: findings stay unlabelled.')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await labeller.getByRole('button', { name: 'Remove' }).click();
  await expect(labeller.getByLabel('Anthropic key')).toBeVisible();
  await expect(labeller.getByText('No key: findings stay unlabelled.')).toBeVisible();
});

test('/account: adding a viewer adds its row, and removing it empties the table', async ({ page }) => {
  await openAccount(page);
  const viewers = page.getByRole('region', { name: 'Viewers', exact: true });
  const table = viewers.getByRole('table', { name: 'Viewers' });
  await expect(table.getByText('No viewers.')).toBeVisible();
  await viewers.getByRole('textbox', { name: 'GitHub login' }).fill('jules-b');
  await viewers.getByRole('button', { name: 'Add viewer' }).click();
  await expect(table.getByRole('row').filter({ hasText: 'jules-b' })).toHaveCount(1);
  await page.waitForLoadState('networkidle');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await table.getByRole('button', { name: 'Remove' }).click();
  await expect(table.getByText('No viewers.')).toBeVisible();
});

test('/account: saving shown projects keeps them ticked and showing mode off', async ({ page }) => {
  await openAccount(page);
  const shown = page.getByRole('region', { name: 'Shown projects', exact: true });
  const first = shown.getByRole('checkbox').first();
  await expect(first).not.toBeChecked();
  await first.check();
  await shown.getByRole('button', { name: 'Save' }).click();
  await page.waitForLoadState('networkidle');
  await page.reload();
  await expect(shown.getByRole('checkbox').first()).toBeChecked();
  const rail = page.getByRole('complementary');
  await expect(rail.getByRole('switch', { name: 'Showing mode' })).not.toBeChecked();
  await expect(rail.getByText(/^Showing:/)).toHaveCount(0);
  // Empties the kept list again, as the fixtures left it.
  await shown.getByRole('checkbox').first().uncheck();
  await shown.getByRole('button', { name: 'Save' }).click();
  await page.waitForLoadState('networkidle');
  await page.reload();
  await expect(shown.getByRole('checkbox').first()).not.toBeChecked();
});

test('Sign out lands on the sign-in page, and a page then redirects there', async ({ page }) => {
  await openAccount(page);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(`${HOSTED_URL}/signin`);
  await page.goto('/work');
  await expect(page).toHaveURL(`${HOSTED_URL}/signin`);
});

// rowan-k may view mika-ito's account, whose one kept project is lantern-notes; viewing is the session's, so a new
// test starts on rowan-k's own dashboard.
test("switching to mika-ito's dashboard shows only her kept project, read-only, and switching back restores", async ({ page }) => {
  await pinClock(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/signin');
  await page.getByRole('link', { name: 'Sign in with GitHub' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
  await page.goto('/work?view=runs');
  const rail = page.getByRole('complementary');
  const switcher = rail.getByRole('combobox', { name: 'Dashboard' });
  const tidepoolRows = page.getByRole('row').filter({ hasText: /tidepool-api|fix\/retry-backoff/ });
  await expect(switcher).toHaveValue('');
  await expect(tidepoolRows).toHaveCount(2);

  await switcher.selectOption('mika-ito');
  await expect(rail.getByText("mika-ito's projects: lantern-notes")).toBeVisible();
  await expect(rail.getByText('Read-only')).toBeVisible();
  await expect(rail.getByRole('switch')).toHaveCount(0);
  await expect(rail.getByRole('button', { name: 'Stop showing' })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'lantern-notes' }).first()).toBeVisible();
  await expect(tidepoolRows).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // Home: her feed, with no "Mark all seen".
  await page.goto('/');
  const feed = page.getByRole('region', { name: 'Since you last looked', exact: true });
  await expect(feed.getByText(/lantern-notes/).first()).toBeVisible();
  await expect(feed.getByRole('button', { name: 'Mark all seen' })).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.goto('/work?view=runs');
  await switcher.selectOption('Yours');
  await expect(rail.getByRole('switch', { name: 'Showing mode' })).toBeVisible();
  await expect(rail.getByText('Read-only')).toHaveCount(0);
  await expect(tidepoolRows).toHaveCount(2);
});

test('at 375 px the switcher and the read-only bar sit in the top row, and the page fits', async ({ page }) => {
  await pinClock(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/signin');
  await page.getByRole('link', { name: 'Sign in with GitHub' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
  const header = page.getByRole('banner');
  await header.getByRole('combobox', { name: 'Dashboard' }).selectOption('mika-ito');
  await expect(header.getByText("mika-ito's projects: lantern-notes")).toBeVisible();
  await expect(header.getByText('Read-only')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.waitForLoadState('networkidle');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
