import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { pinClock } from './fixed-time.ts';

// dev:fixtures' data: report-full, then report-later, which adds a Small run whose branch is HTML, then report-v6
// and report-v7, which adds each unit's context, then report-work, which gives the newer runs their titles (the HTML
// branch's run a title with markup).
const HTML_TEXT = '<img src=x onerror=alert(1)>';
const FULL_TITLE = 'Queue edits offline and replay them on reconnect';
// A run's link is its row's first; its change's link, after it, can carry the same title (feature/webhooks').

/** Opens the Runs view, then the Full run of feature/offline-sync from it, by its title. */
async function openFullRun(page: Page): Promise<void> {
  await page.goto('/work?view=runs');
  const row = page.getByRole('row').filter({ hasText: 'feature/offline-sync' }).filter({ hasText: 'Full' });
  await row.getByRole('link', { name: FULL_TITLE }).click();
  await expect(page.getByRole('heading', { name: 'feature/offline-sync', level: 1 })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await pinClock(page);
});

test('runs list and run page have no axe violations', async ({ page }) => {
  await page.goto('/work?view=runs');
  await expect(page.getByRole('link', { name: FULL_TITLE })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await openFullRun(page);
  const task1 = page.getByRole('group', { name: "The run's flow" }).getByRole('button', { name: /^Task 1(?!\d)/ });
  await task1.click();
  await expect(task1).toHaveAttribute('aria-pressed', 'true');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("the Full run's page has no sideways scroll at 375 px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openFullRun(page);
  await expect(page.getByRole('group', { name: "The run's flow" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('an unknown run key says so at once', async ({ page }) => {
  await page.goto('/runs/0000000000000000');
  // A 404 isn't retried, so the message shows within the default timeout.
  await expect(page.getByText('No run with this key.')).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'Runs', exact: true })).toHaveAttribute('href', '/runs');
});

test("at 1440 px the fold's panels sit in two columns once opened, and pass axe", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFullRun(page);
  const fold = page.locator('details').filter({ hasText: 'Cost, context and skills' });
  await fold.locator('summary').click();
  const names = ['Est. cost by phase', 'Models and advisor', 'Context', 'Skills'];
  const boxes = await Promise.all(names.map((name) => page.getByRole('region', { name, exact: true }).boundingBox()));
  const [cost, models, context, skills] = boxes.map((box) => box!);
  expect(models.x).toBeGreaterThan(cost.x + cost.width);
  expect(models.y).toBe(cost.y);
  expect(context.x).toBe(cost.x);
  expect(skills.x).toBe(models.x);
  expect(context.y).toBeGreaterThan(cost.y);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("at 375 px the fold's panels stack in one column, with no sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openFullRun(page);
  await page.locator('details').filter({ hasText: 'Cost, context and skills' }).locator('summary').click();
  const cost = (await page.getByRole('region', { name: 'Est. cost by phase', exact: true }).boundingBox())!;
  const models = (await page.getByRole('region', { name: 'Models and advisor', exact: true }).boundingBox())!;
  expect(models.x).toBe(cost.x);
  expect(models.y).toBeGreaterThan(cost.y + cost.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("at 375 px, selecting a step brings its detail's title into view", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openFullRun(page);
  await page.getByRole('group', { name: "The run's flow" }).getByRole('button', { name: /^Final review/ }).click();
  const detail = page.getByRole('region', { name: 'Final review', exact: true });
  await expect(detail.getByRole('heading', { name: 'Final review' })).toBeInViewport();
});

test("the Full run's chain opens its plan run and counts its later fix", async ({ page }) => {
  await openFullRun(page);
  const chain = page.getByRole('list', { name: 'Before and after this run' });
  await expect(chain.getByText('1 later fix')).toBeVisible();
  await chain.getByRole('link', { name: 'Plan run' }).click();
  await expect(page).toHaveURL(/\/runs\/51120289e82db399$/);
  await expect(page.getByRole('heading', { name: 'feature/offline-sync', level: 1 })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Before and after this run' }).getByText('This run, plan')).toBeVisible();
});

test("each run's row names its title as the link to its page, its branch after its change and goal", async ({ page }) => {
  await page.goto('/work?view=runs');
  const row = page.getByRole('row').filter({ hasText: 'feature/webhooks' });
  await expect(row.getByRole('cell').nth(3)).toHaveText('feature/webhooks');
  await expect(row.getByRole('cell').nth(4)).toHaveText('tidepool-api');
  await expect(row.getByRole('cell').nth(5)).toHaveText('Full');
  await row.getByRole('link', { name: 'Send webhooks for note changes' }).first().click();
  await expect(page).toHaveURL(/\/runs\/[0-9a-f]{16}$/);
  await expect(page.getByRole('heading', { name: 'feature/webhooks', level: 1 })).toBeVisible();
});

test('a branch with HTML shows as text', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });

  // The Runs view, in its default period: the branch in its cell, the title with markup as the link, both as text.
  await page.goto('/work?view=runs');
  const row = page.getByRole('row').filter({ hasText: HTML_TEXT });
  await expect(row.getByRole('cell', { name: HTML_TEXT })).toBeVisible();
  const link = row.getByRole('link', { name: "Fix the sync log's <b>escaping</b>" });
  await expect(link).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await expect(page.locator('main b')).toHaveCount(0);

  // That run's page.
  await link.click();
  await expect(page.getByRole('heading', { name: HTML_TEXT, level: 1 })).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);

  // A finding's summary on the Full run, in the findings table.
  await openFullRun(page);
  await expect(page.getByRole('cell', { name: HTML_TEXT })).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);

  // The same summary in Task 2's detail.
  await page.getByRole('group', { name: "The run's flow" }).getByRole('button', { name: /^Task 2(?!\d)/ }).click();
  await expect(page.getByRole('table', { name: 'Task 2', exact: true }).getByText(HTML_TEXT)).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  expect(dialogs).toEqual([]);
});

test("the Full run's Strengths table lists its three strengths", async ({ page }) => {
  await openFullRun(page);
  await expect(page.getByRole('heading', { name: 'Strengths (3)' })).toBeVisible();
  const table = page.getByRole('region', { name: 'Strengths table' });
  await expect(table.locator('tbody tr')).toHaveCount(3);
  await expect(table.getByText('No sync payload reaches a log')).toBeVisible();
});

test("at 1440 px the Strengths table's short columns take their content's width, so Summary takes the room", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFullRun(page);
  const table = page.getByRole('region', { name: 'Strengths table' });
  const width = async (name: string) => (await table.getByRole('columnheader', { name, exact: true }).boundingBox())!.width;
  const short = (await Promise.all(['#', 'Step', 'Task', 'Category'].map(width))).reduce((sum, w) => sum + w, 0);
  expect(await width('Summary')).toBeGreaterThan(short);
});

test('the schema 5 run page lists its strengths in the Strengths table', async ({ page }) => {
  await page.goto('/work?view=runs');
  await page.getByRole('link', { name: 'Send webhooks for note changes' }).first().click();
  await expect(page.getByRole('heading', { name: 'feature/webhooks', level: 1 })).toBeVisible();
  const strengths = page.getByRole('region', { name: 'Strengths table' });
  await expect(strengths.locator('tbody tr')).toHaveCount(2);
  await expect(strengths.getByText('Each retry delay has its own test')).toBeVisible();
  await expect(strengths.getByText('The signing secret never reaches a log')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
