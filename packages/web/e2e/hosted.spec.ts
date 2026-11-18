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

test('Sign out lands on the sign-in page, and a page then redirects there', async ({ page }) => {
  await openAccount(page);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(`${HOSTED_URL}/signin`);
  await page.goto('/work');
  await expect(page).toHaveURL(`${HOSTED_URL}/signin`);
});
