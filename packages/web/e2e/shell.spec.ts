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
const PAGES = ['/', '/work', '/work?view=runs', '/work?view=sessions', '/work/changes/6acb252ca65f81f8', '/work/goals/843fdb9f8959fb12', '/findings', '/context', '/compliance', '/steps', '/skills', '/models', '/spend', '/weeks', '/nope'];
// The heatmap cell a page's list waits on: Findings' and Compliance's lists show only once a cell is selected.
const SELECT: Record<string, string> = {
  '/findings': 'Correctness, week of Nov 8: 3',
  '/compliance': 'Step has no agent id, week of Nov 8: 1',
};

for (const width of [375, 768, 1440]) {
  test(`no page scrolls sideways at ${width} px, and none has axe violations there`, async ({ page }) => {
    // Every page and one run's page, each loaded and checked by axe.
    test.slow();
    await pinClock(page);
    await page.setViewportSize({ width, height: 900 });
    const runs = (await (await page.request.get('/api/runs?weeks=52')).json()) as { runs: { key: string }[] };
    const failures: string[] = [];
    for (const path of [...PAGES, `/runs/${runs.runs[0].key}`]) {
      await page.goto(path, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (SELECT[path]) {
        await page.getByRole('button', { name: SELECT[path] }).click();
        await expect(page.locator('[data-list]')).toHaveCount(1);
      }
      const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (extra > 0) failures.push(`${path}: ${extra} px`);
      // Nothing of a list's first glance hides behind a sideways scroll: its narrow columns fold instead.
      const lists = await page.evaluate(() =>
        [...document.querySelectorAll('[data-list]')].map((el) => ({ name: el.getAttribute('aria-label'), extra: el.scrollWidth - el.clientWidth })));
      for (const list of lists) if (list.extra > 0) failures.push(`${path}: the ${list.name} list scrolls sideways by ${list.extra} px`);
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

test('an unknown address shows the not-found page inside the shell, with a way home', async ({ page }) => {
  await pinClock(page);
  await page.goto('/nope');
  await expect(page.getByRole('heading', { level: 1, name: 'Not found' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' }).first()).toBeAttached();
  await page.getByRole('main').getByRole('link', { name: 'Home' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
});

test('Back returns to where the list was scrolled', async ({ page }) => {
  await pinClock(page);
  await page.setViewportSize({ width: 1440, height: 300 });
  await page.goto('/work?view=runs', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const last = page.getByRole('main').getByRole('link').last();
  await last.scrollIntoViewIfNeeded();
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled).toBeGreaterThan(0);
  await last.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Work' })).toBeHidden();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Work' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrolled);
});

test('under reduced motion nothing animates, and a wide table still fades at its edge', async ({ page }) => {
  await pinClock(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/weeks', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  // Every animation and transition on the page, the open dialog's included, ends at once (computed durations are in s).
  const moving = await page.evaluate(() =>
    [...document.querySelectorAll('*')].flatMap((el) => {
      const style = getComputedStyle(el);
      const longest = Math.max(...`${style.animationDuration},${style.transitionDuration}`.split(',').map(parseFloat));
      return longest > 0.00001 ? [`${el.tagName.toLowerCase()}.${el.getAttribute('class') ?? ''}: ${longest} s`.slice(0, 80)] : [];
    }));
  expect(moving).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  // The edge cue is a scroll-driven animation: it follows the table's scroll, not the clock, so it stays.
  const mask = await page.getByRole('region', { name: 'By week table', exact: true }).evaluate((el) => getComputedStyle(el).maskImage);
  expect(mask).toContain('100% - 48px');
});

test("the browser's bar takes the backdrop's colour, and follows the system's light and dark", async ({ page }) => {
  await pinClock(page);
  await page.goto('/');
  const colours: string[] = [];
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await expect(page.locator('html')).toHaveClass(colorScheme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/);
    const background = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--background').trim());
    expect(background).toMatch(/^#[0-9a-f]{6}$/i);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', background);
    colours.push(background);
  }
  expect(colours[0]).not.toBe(colours[1]);
});

test('a table that scrolls sideways fades at the edge hiding columns, and one that fits does not', async ({ page }) => {
  await pinClock(page);
  const mask = (name: string) => page.getByRole('region', { name, exact: true }).evaluate((el) => getComputedStyle(el).maskImage);
  const scrollTo = (share: number) =>
    page.getByRole('region', { name: 'By week table', exact: true }).evaluate((el, share) => { el.scrollLeft = (el.scrollWidth - el.clientWidth) * share; }, share);
  const [clear, ink] = ['rgba(0, 0, 0, 0)', 'rgb(0, 0, 0)'];
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/weeks', { waitUntil: 'networkidle' });
  // At the start only the right edge fades, both once scrolled, only the left at the end.
  expect(await mask('By week table')).toBe(`linear-gradient(to right, ${ink} calc(100% - 48px), ${clear})`);
  // The mask cuts what is drawn outside the box, so the keyboard's focus outline is drawn inside it.
  await page.keyboard.press('Tab');
  const focus = await page.getByRole('region', { name: 'By week table', exact: true }).evaluate((el) => {
    el.focus();
    const style = getComputedStyle(el);
    return { visible: el.matches(':focus-visible'), mask: style.maskImage, outline: style.outlineStyle, inside: parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth) <= 0 };
  });
  expect(focus).toEqual({ visible: true, mask: expect.stringContaining('100% - 48px'), outline: 'solid', inside: true });
  await scrollTo(0.5);
  await expect.poll(() => mask('By week table')).toBe(`linear-gradient(to right, ${clear}, ${ink} 48px, ${ink} calc(100% - 48px), ${clear})`);
  await scrollTo(1);
  await expect.poll(() => mask('By week table')).toBe(`linear-gradient(to right, ${clear}, ${ink} 48px)`);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/skills', { waitUntil: 'networkidle' });
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
  await expect(pages.getByRole('link')).toHaveCount(10);
  await page.keyboard.press('Escape');
  await expect(pages).toBeHidden();
  await menu.click();
  await pages.getByRole('button', { name: 'Close' }).click();
  await expect(pages).toBeHidden();
  await menu.click();
  await pages.getByRole('link', { name: 'Work' }).click();
  await expect(page).toHaveURL(/\/work$/);
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

test("the tab is named by the page's title and edward, and has its mark as icon", async ({ page }) => {
  await pinClock(page);
  await page.goto('/');
  await expect(page).toHaveTitle('Home - edward');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg');
  const icon = await page.request.get('/favicon.svg');
  expect(icon.headers()['content-type']).toContain('image/svg+xml');
  expect(await icon.text()).toContain('<svg');
});

test('the first Tab reaches Skip to content, which moves the keyboard into the page without changing the address', async ({ page }) => {
  await pinClock(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/work?view=runs');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).not.toBeInViewport();
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('main :focus')).toHaveCount(1);
  await expect(page).toHaveURL(/\/work\?view=runs$/);
});

test('a first load focuses nothing, and following a menu link focuses the new page\'s title', async ({ page }) => {
  await pinClock(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'networkidle' });
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await page.getByRole('complementary').getByRole('link', { name: 'Work' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Work' })).toBeFocused();
});

test('following a link in the Menu dialog focuses the new page\'s title, and Escape returns to the Menu button', async ({ page }) => {
  await pinClock(page);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Menu' });
  await menu.click();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await menu.click();
  await page.getByRole('dialog', { name: 'Pages' }).getByRole('link', { name: 'Spend' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Spend' })).toBeFocused();
});

test("a link that changes only the address's query leaves the focus where it was", async ({ page }) => {
  await pinClock(page);
  await page.goto('/compliance?step=final_review');
  const clear = page.getByRole('link', { name: 'Clear the step filter' });
  await clear.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/compliance$/);
  await expect(page.getByRole('rowheader', { name: 'Simplify record differs' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).not.toBeFocused();
});

test("a Menu dialog link to the page already shown returns the focus to the Menu button", async ({ page }) => {
  await pinClock(page);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/spend');
  const menu = page.getByRole('button', { name: 'Menu' });
  await menu.click();
  await page.getByRole('dialog', { name: 'Pages' }).getByRole('link', { name: 'Spend' }).click();
  await expect(page.getByRole('dialog', { name: 'Pages' })).toBeHidden();
  await expect(menu).toBeFocused();
});
