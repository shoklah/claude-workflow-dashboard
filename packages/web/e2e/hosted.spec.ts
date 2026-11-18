import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
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
