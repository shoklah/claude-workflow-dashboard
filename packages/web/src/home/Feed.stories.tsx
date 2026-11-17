import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import type { HomeResponse, StatusResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { emptyHome, fullHome } from '../test/home.ts';
import { mockApi } from '../test/mock-api.ts';
import { Feed } from './Feed.tsx';

const meta = { component: Feed } satisfies Meta<typeof Feed>;
export default meta;
type Story = StoryObj<typeof meta>;

const LAST_GOOD = '2026-11-12T10:00:00.000Z';
const ok: StatusResponse = { lastImportAt: LAST_GOOD, lastGoodImportAt: LAST_GOOD, error: null, importing: false };

const EMPTY = 'Nothing new. Finished runs and new warnings show here until you mark them seen.';

/** An item's facts as [term, value] pairs. */
const facts = (item: HTMLElement) =>
  within(item)
    .queryAllByRole('term')
    .map((term) => [term.textContent, term.nextElementSibling?.textContent]);

/** Empty: nothing new since the last look, so nothing to mark seen. */
export const Empty: Story = {
  args: { items: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('region', { name: 'Since you last looked' })).toHaveClass('glass');
    await expect(canvas.getByText(EMPTY)).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Mark all seen' })).toBeNull();
  },
};

/** Full: finished runs and new warnings, newest first, each led by its branch; free text shows as text, never as HTML. */
export const Full: Story = {
  args: { items: fullHome.feed },
  play: async ({ canvas, canvasElement }) => {
    const items = within(canvas.getByRole('list')).getAllByRole('listitem');
    await expect(items).toHaveLength(4);

    // A finished run: its title opening the run, its project and path, then its facts as labelled pairs.
    await expect(items[0]).toHaveTextContent('Run finished');
    await expect(within(items[0]).getByRole('link', { name: 'Search every note by title and body' })).toHaveAttribute('href', '/runs/a1b2c3d4e5f60718');
    await expect(within(items[0]).getByText('atlas, Full path')).toBeVisible();
    await expect(facts(items[0])).toEqual([
      ['Findings', '6'],
      ['Acted on', '5'],
      ['Open', '0'],
      ['Time', '2 h 10'],
      ['Est. cost', '$7.10'],
    ]);
    await expect(items[0].querySelector('time')).toHaveAttribute('datetime', '2026-11-12T10:40:00.000Z');
    await expect(items[0].querySelector('.bg-success-edge')).not.toBeNull();

    // A session's warning: no run to open, its session trailing on its own line.
    await expect(items[1]).toHaveTextContent('New warning');
    await expect(within(items[1]).queryByRole('link')).toBeNull();
    await expect(within(items[1]).getByRole('button', { name: 'Copy session ID' })).toBeVisible();
    await expect(items[1]).toHaveTextContent('Typed "grill me" but grill-me never loaded');
    await expect(items[1].querySelector('.bg-warning-edge')).not.toBeNull();

    // A run's warning opens its run; the run's own "branch (date):" lead is gone, the branch already leads.
    await expect(within(items[2]).getByRole('link', { name: 'Search every note by title and body' })).toHaveAttribute('href', '/runs/a1b2c3d4e5f60718');
    await expect(within(items[2]).getByText('final-reviewer ran on another model than its pin')).toBeVisible();
    await expect(facts(items[2])).toEqual([]);

    await expect(within(items[3]).getByRole('link', { name: '<img src=x onerror=alert(1)>' })).toHaveAttribute(
      'href',
      '/runs/0f1e2d3c4b5a6978',
    );
    await expect(within(items[3]).getByText('harbor, Small path')).toBeVisible();
    await expect(facts(items[3])).toEqual([
      ['Findings', '1'],
      ['Acted on', '1'],
      ['Open', '0'],
      ['Time', '25 min'],
      ['Est. cost', '$1.20'],
    ]);
    await expect(canvasElement.querySelector('img')).toBeNull();

    // The status is a swatch beside its word, not a coloured edge; nothing is joined with " · ".
    await expect(canvasElement.querySelector('.border-l-4, .border-l-3')).toBeNull();
    await expect(canvasElement.textContent).not.toContain(' · ');
  },
};

/** A warning as the log writes it: its "WARN:" prefix never shows. */
export const LogPrefix: Story = {
  args: { items: [{ ...fullHome.feed[2], text: 'WARN: feat/search (2026-11-12): final-reviewer ran on another model than its pin' }] },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText('final-reviewer ran on another model than its pin')).toBeVisible();
    await expect(canvasElement.textContent).not.toContain('WARN:');
  },
};

/** A finished run whose cost, time and findings aren't known: each a dash read out as not known, never 0. */
export const Unknowns: Story = {
  args: { items: [{ ...fullHome.feed[0], findings: null, minutes: null, cost: null }] },
  play: async ({ canvas }) => {
    await expect(facts(canvas.getByRole('listitem'))).toEqual([
      ['Findings', '–not known'],
      ['Acted on', '–not known'],
      ['Open', '–not known'],
      ['Time', '–not known'],
      ['Est. cost', '–not known'],
    ]);
  },
};

// The server's answers for MarkAllSeen; the home answer turns empty once the POST lands, as the server's would.
const routes: Record<string, object | number> = {};

/** Marking all seen posts once, then the home data is read again and the feed empties. */
export const MarkAllSeen: Story = {
  args: { items: fullHome.feed },
  beforeEach: () => {
    Object.assign(routes, { '/api/status': ok, '/api/home': fullHome, '/api/seen': 204 });
    mockApi(routes);
  },
  // The page's way of feeding the list: the live home query.
  render: function Render() {
    const home = useLiveQuery<HomeResponse>('/api/home');
    return <Feed items={home.data?.feed ?? []} />;
  },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findAllByRole('listitem')).toHaveLength(4);
    routes['/api/home'] = emptyHome;

    const mark = canvas.getByRole('button', { name: 'Mark all seen' });
    // Every button is a pill (DESIGN.md), through index.css's one rule.
    await expect(getComputedStyle(mark).borderTopLeftRadius).toBe('9999px');
    await userEvent.click(mark);

    await expect(await canvas.findByText(EMPTY)).toBeVisible();
    const posts = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.filter(
      ([path]) => path === '/api/seen',
    );
    await expect(posts).toEqual([['/api/seen', { method: 'POST', headers: { 'X-Dashboard-Refresh': '1' } }]]);
    await waitFor(() => expect(canvas.queryAllByRole('listitem')).toHaveLength(0));
  },
};
