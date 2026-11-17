import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';
import { settled } from './settled.ts';

test('the shell has no axe violations', async ({ page }) => {
  await pinClock(page);
  await page.goto('/');
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

// Every page fits the viewport at a phone's, a tablet's and a desktop's width: what is wider (a table, a chart grid)
// scrolls inside its own region, never the page, and a region that scrolls can take the keyboard's focus (axe).
const PAGES = ['/', '/runs', '/findings', '/sessions', '/context', '/compliance', '/steps', '/skills', '/models', '/spend', '/weeks'];

for (const width of [375, 768, 1440]) {
  test(`no page scrolls sideways at ${width} px, and none has axe violations there`, async ({ page }) => {
    // Twelve pages, each loaded and checked by axe.
    test.slow();
    await pinClock(page);
    await page.setViewportSize({ width, height: 900 });
    const runs = (await (await page.request.get('/api/runs?weeks=52')).json()) as { runs: { key: string }[] };
    const failures: string[] = [];
    for (const path of [...PAGES, `/runs/${runs.runs[0].key}`]) {
      await page.goto(path, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (extra > 0) failures.push(`${path}: ${extra} px`);
      const { violations } = await new AxeBuilder({ page }).analyze();
      for (const v of violations) failures.push(`${path}: ${v.id}`);
      // Secondary and status inks appear only on a panel: nothing in them has the backdrop as its nearest painted surface.
      const offenders = await page.evaluate(() =>
        [...document.querySelectorAll('main .text-muted-foreground, main [class*="text-warning-ink"]')]
          // textContent, since an SVG (an icon) carrying the class has no innerText.
          .filter((el) => (el.textContent ?? '').trim() !== '' && !el.closest('.glass, [data-slot="table-container"], [role="status"]'))
          .map((el) => (el.textContent ?? '').slice(0, 40)));
      if (offenders.length > 0) failures.push(`${path}: ink on the backdrop: ${offenders.join(' | ')}`);
    }
    expect(failures).toEqual([]);
  });
}

test('a table that scrolls sideways fades at the edge hiding columns, and one that fits does not', async ({ page }) => {
  await pinClock(page);
  const cueEnd = (name: string) => page.getByRole('region', { name, exact: true }).evaluate((el) => getComputedStyle(el).getPropertyValue('--cue-end').trim());
  const mask = (name: string) => page.getByRole('region', { name, exact: true }).evaluate((el) => getComputedStyle(el).maskImage);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/sessions', { waitUntil: 'networkidle' });
  expect(await cueEnd('Sessions')).toBe('48px');
  expect(await mask('Sessions')).toContain('100% - 48px');
  // The mask cuts what is drawn outside the box, so the keyboard's focus outline is drawn inside it.
  await page.keyboard.press('Tab');
  const focus = await page.getByRole('region', { name: 'Sessions', exact: true }).evaluate((el) => {
    el.focus();
    const style = getComputedStyle(el);
    return { visible: el.matches(':focus-visible'), mask: style.maskImage, outline: style.outlineStyle, inside: parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth) <= 0 };
  });
  expect(focus).toEqual({ visible: true, mask: expect.stringContaining('100% - 48px'), outline: 'solid', inside: true });
  await page.getByRole('region', { name: 'Sessions', exact: true }).evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await expect.poll(() => cueEnd('Sessions')).toBe('0px');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/skills', { waitUntil: 'networkidle' });
  expect(await cueEnd('Skills')).toBe('0px');
  // No mask at all on a table that fits: a mask clips the panel's shadow.
  expect(await mask('Skills')).toBe('none');
});

test('under 768 px the menu is behind a Menu button', async ({ page }) => {
  await pinClock(page);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/spend');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
  await expect(page.getByRole('complementary')).toBeHidden();
  const menu = page.getByRole('button', { name: 'Menu' });
  const pages = page.getByRole('dialog', { name: 'Pages' });
  await menu.click();
  await expect(pages.getByText('edward', { exact: true })).toBeVisible();
  await expect(pages.getByRole('link')).toHaveCount(11);
  await page.keyboard.press('Escape');
  await expect(pages).toBeHidden();
  await menu.click();
  await pages.getByRole('button', { name: 'Close' }).click();
  await expect(pages).toBeHidden();
  await menu.click();
  await pages.getByRole('link', { name: 'Runs' }).click();
  await expect(page).toHaveURL(/\/runs$/);
  await expect(pages).toBeHidden();
  await expect(page.getByRole('button', { name: 'Refresh' })).toBeInViewport();
});

test('the rail stays put while a long page scrolls, with no header row', async ({ page }) => {
  await pinClock(page);
  const rail = page.getByRole('complementary');
  // The rail starts at 768 px.
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(rail).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('banner')).toBeHidden();
  for (const name of ['Activity', 'Usage and cost', 'Workflow']) await expect(rail.getByRole('group', { name })).toBeVisible();
  await expect(rail.getByText(/^Imported /)).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(rail.getByText('edward', { exact: true })).toBeInViewport();
  await expect(rail.getByRole('button', { name: 'Refresh' })).toBeInViewport();
  expect(Math.round((await rail.boundingBox())!.height)).toBe(900 - 24);
});

test('on a short phone the Menu dialog scrolls to its last link', async ({ page }) => {
  await pinClock(page);
  await page.setViewportSize({ width: 375, height: 480 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  const pages = page.getByRole('dialog', { name: 'Pages' });
  const box = (await pages.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(480);
  const last = pages.getByRole('link', { name: 'Models and advisor' });
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  await settled(pages);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('the tab is named edward and has its mark as icon', async ({ page }) => {
  await pinClock(page);
  await page.goto('/');
  await expect(page).toHaveTitle('edward');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg');
  const icon = await page.request.get('/favicon.svg');
  expect(icon.headers()['content-type']).toContain('image/svg+xml');
  expect(await icon.text()).toContain('<svg');
});
