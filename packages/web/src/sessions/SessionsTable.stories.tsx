import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { fullRun, smallRun } from '../test/runs.ts';
import { sessionsFull } from '../test/sessions.ts';
import { SessionsTable } from './SessionsTable.tsx';

const meta = { component: SessionsTable } satisfies Meta<typeof SessionsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { sessions: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table')).toBeVisible();
    await expect(canvas.getByText('No sessions in this period.')).toBeVisible();
  },
};

/** Full: a row per session; a row opens its timeline, its runs' window starts linking to their pages. */
export const Full: Story = {
  args: { sessions: sessionsFull.sessions },
  play: async ({ canvas, userEvent }) => {
    const headers = canvas.getAllByRole('columnheader').map((th) => th.textContent);
    await expect(headers).toEqual([
      'Session',
      'Project',
      'Started',
      'Length',
      'Skills loaded',
      'Commands typed',
      'Model',
      'Est. cost',
      'Startup',
      'Warnings',
      'Holds',
    ]);
    await expect(canvas.getAllByRole('row').slice(1)).toHaveLength(3);

    const [two, other, quiet] = canvas.getAllByRole('row').slice(1).map((row) => within(row));
    await expect(two.getByText('7d1e4b2a')).toBeVisible();
    await expect(two.getByText('brainstorming')).toBeVisible();
    await expect(two.getByText('/grill-me · never loaded')).toBeVisible();
    await expect(two.getByText('/graphify')).toBeVisible();
    await expect(two.getByText('claude-opus-5-5 · medium')).toBeVisible();
    await expect(two.getByText('2 h 40')).toBeVisible();
    await expect(two.getByRole('link', { name: 'atlas · feat/search · full' })).toHaveAttribute(
      'href',
      `/runs/${fullRun.key}`,
    );
    await expect(two.getByRole('link', { name: 'harbor · fix/retry · small' })).toHaveAttribute(
      'href',
      `/runs/${smallRun.key}`,
    );
    await expect(other.getByText('no title')).toBeVisible();
    await expect(other.getByText('other project')).toBeVisible();
    await expect(other.getByText('no')).toBeVisible();
    await expect(quiet.getByText('none')).toBeVisible();

    // Closed, a row shows no timeline; opening it lists the skill loads, the commands and the runs' windows in order.
    await expect(canvas.queryByRole('list', { name: 'Timeline of Plan the search index' })).toBeNull();
    const toggle = canvas.getByRole('button', { name: 'Plan the search index' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const timeline = canvas.getByRole('list', { name: 'Timeline of Plan the search index' });
    const items = within(timeline).getAllByRole('listitem').map((li) => li.textContent);
    await expect(items).toHaveLength(6);
    await expect(items[0]).toMatch(/skill brainstorming · wrote a file$/);
    await expect(items[2]).toMatch(/command \/grill-me · its skill never loaded$/);
    await expect(items[3]).toMatch(/window starts · atlas · feat\/search · full$/);
    await expect(within(timeline).getByRole('link', { name: 'harbor · fix/retry · small' })).toHaveAttribute(
      'href',
      `/runs/${smallRun.key}`,
    );
    await userEvent.click(toggle);
    await expect(canvas.queryByRole('list', { name: 'Timeline of Plan the search index' })).toBeNull();
  },
};
