import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import type { StatusResponse } from '@cwd/shared';
import { emptyHome, fullHome } from '../test/home.ts';
import { mockApi } from '../test/mock-api.ts';
import { HomePage } from './HomePage.tsx';

const meta = { component: HomePage } satisfies Meta<typeof HomePage>;
export default meta;
type Story = StoryObj<typeof meta>;

const LAST_GOOD = '2026-11-12T10:00:00.000Z';
const ok: StatusResponse = { lastImportAt: LAST_GOOD, lastGoodImportAt: LAST_GOOD, error: null, importing: false };

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': ok, '/api/home': 'pending' });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Loading…')).toBeVisible();
    await expect(canvas.queryByRole('group', { name: 'Runs this week' })).toBeNull();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': ok, '/api/home': 500 });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Can't load the home screen.")).toBeVisible();
  },
};

/** Empty: nothing imported yet; every section stands, at zero, and the feed has nothing new. */
export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': ok, '/api/home': emptyHome });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('group', { name: 'Runs this week' })).toHaveTextContent('0');
    await expect(canvas.getByRole('tab', { name: 'Full path' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Cost by week' })).toBeVisible();
    await expect(canvas.getByText('Nothing new.')).toBeVisible();
  },
};

/** Full: tiles, the diagram, the charts and the feed, from one home response. */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': ok, '/api/home': fullHome });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('group', { name: 'Findings' })).toHaveTextContent('19');
    await expect(canvas.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument();
    await expect(canvas.getByText('fix-checks: 7 ran · 1 still open · 1 reached round 3')).toBeVisible();
    await expect(canvas.getByText(/Weeks before Oct 5, 2026/)).toBeVisible();
    await expect(canvas.getAllByRole('listitem')).toHaveLength(4);
    await expect(canvas.getByRole('button', { name: 'Mark all seen' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Skills and commands' })).toBeVisible();
    await expect(canvas.getByText('23 sessions · 6 runs')).toBeVisible();
  },
};
