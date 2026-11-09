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

/** Empty: nothing new since the last look, so nothing to mark seen. */
export const Empty: Story = {
  args: { items: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Since you last looked' })).toBeVisible();
    await expect(canvas.getByText('Nothing new.')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Mark all seen' })).toBeNull();
  },
};

/** Full: finished runs and new warnings, newest first; free text shows as text, never as HTML. */
export const Full: Story = {
  args: { items: fullHome.feed },
  play: async ({ canvas, canvasElement }) => {
    const items = within(canvas.getByRole('list')).getAllByRole('listitem');
    await expect(items).toHaveLength(4);
    await expect(items[0]).toHaveTextContent('Run finished · atlas · feat/search · full');
    await expect(items[0]).toHaveTextContent('6 findings · 5 acted on · 0 open · 2 h 10 min · $7.10');
    await expect(items[1]).toHaveTextContent('New warning');
    await expect(within(items[1]).getByRole('button', { name: 'Copy session ID' })).toBeVisible();
    await expect(items[1]).toHaveTextContent('typed "grill me" but grill-me never loaded');
    await expect(items[2]).toHaveTextContent('New warning · atlas · feat/search');
    await expect(items[3]).toHaveTextContent('Run finished · harbor · <img src=x onerror=alert(1)> · small');
    await expect(items[3]).toHaveTextContent('1 finding · 1 acted on · 0 open · 25 min · $1.20');
    await expect(canvasElement.querySelector('img')).toBeNull();
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

    await userEvent.click(canvas.getByRole('button', { name: 'Mark all seen' }));

    await expect(await canvas.findByText('Nothing new.')).toBeVisible();
    const posts = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.filter(
      ([path]) => path === '/api/seen',
    );
    await expect(posts).toEqual([['/api/seen', { method: 'POST', headers: { 'X-Dashboard-Refresh': '1' } }]]);
    await waitFor(() => expect(canvas.queryAllByRole('listitem')).toHaveLength(0));
  },
};
