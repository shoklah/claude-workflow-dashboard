import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

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
    await pinClock(page);
    await page.setViewportSize({ width, height: 900 });
    const runs = (await (await page.request.get('/api/runs?weeks=52')).json()) as { runs: { key: string }[] };
    const failures: string[] = [];
    for (const path of [...PAGES, `/runs/${runs.runs[0].key}`]) {
      await page.goto(path, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const extra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (extra > 0) failures.push(`${path}: ${extra} px`);
      const { violations } = await new AxeBuilder({ page }).analyze();
      for (const v of violations) failures.push(`${path}: ${v.id}`);
    }
    expect(failures).toEqual([]);
  });
}
