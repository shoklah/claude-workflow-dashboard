import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectLegendClear } from './charts.ts';
import { pinClock } from './fixed-time.ts';
import { settled } from './settled.ts';

test.beforeEach(async ({ page }) => {
  await pinClock(page);
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'This week' })).toBeVisible();
});

test('home has no axe violations', async ({ page }) => {
  await expect(page.getByRole('figure', { name: 'Final review' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

// The workflow's paths are a switch of pressed-state buttons; the Small path's boxes still pass axe.
test('the path switch shows the Small path', async ({ page }) => {
  const small = page.getByRole('button', { name: 'Small path' });
  await small.click();
  await expect(small).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Full path' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('figure', { name: 'Plan review' })).toHaveCount(0);
  await settled(page.getByRole('group', { name: 'Path' }));
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

// report-later's new run is on the branch `<img src=x onerror=alert(1)>`, and report-work titles it with markup: the
// feed names it by its title as text, and no warning shows the log's "WARN:" prefix.
test('a summary with HTML shows as text', async ({ page }) => {
  const feed = page.getByRole('region', { name: 'Since you last looked', exact: true });
  await expect(feed.getByRole('link', { name: "Fix the sync log's <b>escaping</b>" })).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await expect(feed).not.toContainText('WARN:');
});

// The feed never sets the page's length: at the default 1280 px its list scrolls inside it, and the feed stands where
// the rail does, its top and foot the rail's, from the first paint to the page's end. Stacked, its cap is the Feed stories'.
test('the feed stands where the rail does, its list scrolling inside it', async ({ page }) => {
  const list = page.getByRole('region', { name: 'Since you last looked list' });
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  const feed = page.getByRole('region', { name: 'Since you last looked', exact: true });
  const rail = page.getByRole('complementary');
  const band = async (box: typeof feed) => {
    const { y, height } = (await box.boundingBox())!;
    return [Math.round(y), Math.round(y + height)];
  };
  expect(await band(feed)).toEqual(await band(rail));
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  expect(await band(feed)).toEqual(await band(rail));
});

// The diagram keeps its boxes at their own size (12 px text) at every width: where they don't fit, the flow scrolls
// sideways in its own focusable region, so every box is whole and reachable, and the page itself never scrolls sideways.
for (const width of [375, 768, 1440]) {
  test.describe(`at ${width} px`, () => {
    // Sized before loading, as the shell's check does: a chart resizes a moment after the window does.
    test.use({ viewport: { width, height: 900 } });

    test('every step box is readable and reachable', async ({ page }) => {
      const flow = page.getByRole('region', { name: 'Workflow steps, Full path' });
      await expect(flow).toHaveAttribute('tabindex', '0');
      const boxes = flow.getByRole('figure');
      await expect(boxes).toHaveCount(5);
      for (const box of await boxes.all()) {
        await box.scrollIntoViewIfNeeded();
        await expect(box).toBeInViewport({ ratio: 1 });
        // Drawn at full size: the box's 12 px text is never scaled down.
        const scale = await box.evaluate((el) => el.getBoundingClientRect().width / (el as HTMLElement).offsetWidth);
        expect(scale).toBeGreaterThanOrEqual(1);
        const size = await box.getByText('Ran').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        expect(size * scale).toBeGreaterThanOrEqual(12);
      }
      const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(extra).toBe(0);
    });

    // The findings chart's legend: every label whole, none over a week label, and no empty band above it.
    test("the findings chart's legend labels are whole and fit their room", async ({ page }) => {
      const chart = page.getByRole('img', { name: /^Findings by week, by step:/ });
      await expect(chart).toBeVisible();
      // The weeks and the step kinds, as the charts' table view names them.
      await page.getByText('The charts as a table').click();
      const table = page.getByRole('region', { name: 'The charts as a table' });
      const weeks = await table.getByRole('rowheader').allTextContents();
      const kinds = (await table.getByRole('columnheader').allTextContents())
        .filter((h) => h.endsWith(' findings'))
        .map((h) => h.replace(/ findings$/, ''));
      await expectLegendClear(chart, weeks, kinds);
    });
  });
}
