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

test('the old Runs and Sessions paths land on their views of Work', async ({ page }) => {
  await page.goto('/runs');
  await expect(page).toHaveURL(/\/work\?view=runs$/);
  await expect(page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Runs' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Runs table' })).toBeVisible();

  await page.goto('/sessions');
  await expect(page).toHaveURL(/\/work\?view=sessions$/);
  await expect(page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Sessions' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Sessions', exact: true })).toBeVisible();
});

test("the menu marks Work current on Work and on a run's page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const work = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Work' });
  await page.goto('/work');
  await expect(work).toHaveAttribute('aria-current', 'page');

  await page.goto('/work?view=runs');
  await page.getByRole('link', { name: 'Send webhooks for note changes' }).first().click();
  await expect(page).toHaveURL(/\/runs\/[0-9a-f]{16}$/);
  await expect(work).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('navigation', { name: 'Main' }).locator('[aria-current="page"]')).toHaveCount(1);
});

test('a link to one session lists it open under a chip that clears it, and passes axe', async ({ page, request }) => {
  const sessions = (await (await request.get('/api/sessions?weeks=52')).json()) as { sessions: { key: string; title: string | null }[] };
  const plan = sessions.sessions.find((s) => s.title === 'Offline sync plan')!;
  await page.goto(`/work?view=sessions&session=${plan.key}`);
  await expect(page.getByText('Session: Offline sync plan')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Offline sync plan' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('table', { name: 'Timeline of Offline sync plan' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole('link', { name: 'Clear the session filter' }).click();
  await expect(page).toHaveURL(/\/work\?view=sessions$/);
  await expect(page.getByText(/^Session: /)).toHaveCount(0);
});

// At 1440 px the title columns (Run, Change, Session) share one wrap rule, each between its minimum and maximum width,
// never down to a word and never as wide as its longest title, and the other text columns wrap, so the Runs table fits
// its panel with every column kept.
test('at 1440 px the title columns wrap within one width range, and the Runs table fits', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const widths = (name: string, heads: string[]) =>
    page.getByRole('region', { name, exact: true }).evaluate(
      (el, heads) =>
        Object.fromEntries(
          [...el.querySelectorAll('thead th')]
            .filter((th) => heads.includes(th.textContent ?? ''))
            .map((th) => [th.textContent, Math.round(th.getBoundingClientRect().width)]),
        ),
      heads,
    );
  const overflow = (name: string) => page.getByRole('region', { name, exact: true }).evaluate((el) => el.scrollWidth - el.clientWidth);
  const inRange = { asymmetricMatch: (w: number) => w >= 144 && w <= 288, toString: () => '144 to 288 px' };
  await page.goto('/work?view=runs', { waitUntil: 'networkidle' });
  expect(await widths('Runs table', ['Run', 'Change'])).toEqual({ Run: inRange, Change: inRange });
  expect(await overflow('Runs table')).toBeLessThanOrEqual(0);
  await page.goto('/work?view=sessions', { waitUntil: 'networkidle' });
  expect(await widths('Sessions', ['Session', 'Change'])).toEqual({ Session: inRange, Change: inRange });
});
