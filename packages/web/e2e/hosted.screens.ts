import { expect, test } from '@playwright/test';
import { HOSTED_URL } from '../playwright.config.ts';
import { pinClock } from './fixed-time.ts';

test.use({ baseURL: HOSTED_URL });

for (const [name, path] of [['signin', '/signin'], ['signin-refused', '/signin?error=refused']]) {
  for (const width of [1440, 375]) {
    test(`${path} at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await pinClock(page);
      await page.goto(path);
      await expect(page.getByRole('link', { name: 'Sign in with GitHub' })).toBeVisible();
      await expect(page).toHaveScreenshot(`${name}-${width}.png`);
    });
  }
}

for (const width of [1440, 375]) {
  test(`/account at ${width} px, signed in`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await pinClock(page);
    await page.goto('/signin');
    await page.getByRole('link', { name: 'Sign in with GitHub' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
    await page.goto('/account');
    await expect(page.getByText('No tokens. Create one for your collector.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Shown projects' }).getByRole('checkbox').first()).toBeVisible();
    await expect(page).toHaveScreenshot(`account-${width}.png`);
  });
}

for (const width of [1440, 375]) {
  test(`/ at ${width} px, viewing mika-ito's dashboard`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await pinClock(page);
    await page.goto('/signin');
    await page.getByRole('link', { name: 'Sign in with GitHub' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Dashboard' }).selectOption('mika-ito');
    // The bar is drawn twice, in the rail and in the top row, one hidden by breakpoint.
    await expect(page.getByText("mika-ito's projects: lantern-notes").filter({ visible: true })).toBeVisible();
    // The bar comes with the status, before Home's refetch: wait for the viewed account's feed, not the owner's.
    await expect(page.getByRole('region', { name: 'Since you last looked' }).getByRole('listitem')).toHaveCount(3);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(`viewer-${width}.png`);
  });
}

for (const width of [1440, 375]) {
  test(`/admin at ${width} px, signed in as the admin`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await pinClock(page);
    await page.goto('/signin');
    await page.getByRole('link', { name: 'Sign in with GitHub' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
    await page.goto('/admin');
    await expect(page.getByRole('table', { name: 'Accounts' }).getByText('mika-ito')).toBeVisible();
    await expect(page).toHaveScreenshot(`admin-${width}.png`);
  });
}
