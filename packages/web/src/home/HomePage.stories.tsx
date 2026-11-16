import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
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
    const state = await canvas.findByText('Loading the home screen…');
    await expect(state).toBeVisible();
    await expect(state.closest('.glass')).not.toBeNull();
    await expect(canvas.queryByRole('region', { name: 'This week' })).toBeNull();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': ok, '/api/home': 500 });
  },
  play: async ({ canvas }) => {
    const state = await canvas.findByText("Can't load the home screen.");
    await expect(state).toBeVisible();
    await expect(state.closest('.glass')).not.toBeNull();
  },
};

/** Empty: nothing imported yet; every section stands, at zero, and the feed has nothing new. */
export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': ok, '/api/home': emptyHome });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('region', { name: 'This week' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Full path' })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('heading', { name: 'Cost by week ($)' })).toBeVisible();
    await expect(
      canvas.getByText('Nothing new. Finished runs and new warnings show here until you mark them seen.'),
    ).toBeVisible();
    await expect(canvas.getByText('No skill loaded and no command typed in this period.')).toBeVisible();
  },
};

/** Full: the week's tables, the diagram, the charts, the skills and the feed, from one home response. */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': ok, '/api/home': fullHome });
  },
  play: async ({ canvas, canvasElement }) => {
    const week = within(await canvas.findByRole('region', { name: 'This week' }));
    for (const name of ['Runs', 'Findings', 'Est. cost ($)', 'Warnings']) await expect(week.getByRole('table', { name })).toBeVisible();
    await expect(canvas.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
    await expect(canvasElement.querySelector('[role="tab"]')).toBeNull();
    await expect(canvas.getByRole('button', { name: 'Full path' })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', { name: 'Small path' })).toHaveAttribute('aria-pressed', 'false');
    await expect(canvas.getByText(/Weeks before Oct 5 show/)).toBeVisible();
    await expect(canvas.getByText('The charts as a table').closest('details')).not.toBeNull();
    const feed = within(canvas.getByRole('region', { name: 'Since you last looked' }));
    await expect(feed.getAllByRole('listitem')).toHaveLength(4);
    await expect(feed.getByRole('button', { name: 'Mark all seen' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Skills and commands' })).toBeVisible();
    await expect(canvas.getByText('23 sessions and 6 runs')).toBeVisible();
    // One value per cell, everywhere on the page.
    for (const cell of canvasElement.querySelectorAll('td, th')) await expect(cell.textContent).not.toContain(' · ');
  },
};
