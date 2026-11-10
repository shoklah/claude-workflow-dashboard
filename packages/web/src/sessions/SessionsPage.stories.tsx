import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import type { StatusResponse } from '@cwd/shared';
import { mockApi } from '../test/mock-api.ts';
import { runsFull } from '../test/runs.ts';
import { otherSession, sessionsEmpty, sessionsFull, sessionsHidden, twoRunSession } from '../test/sessions.ts';
import { SessionsPage } from './SessionsPage.tsx';

const meta = { component: SessionsPage } satisfies Meta<typeof SessionsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

const AT = '2026-11-12T10:00:00.000Z';
const status: StatusResponse = { lastImportAt: AT, lastGoodImportAt: AT, error: null, importing: false };
const PROJECTS = '/api/runs?weeks=52';

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [PROJECTS]: runsFull, '/api/sessions?weeks=4': 'pending' });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Loading the sessions…')).toBeVisible();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [PROJECTS]: runsFull, '/api/sessions?weeks=4': 500 });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Couldn't load the sessions.")).toBeVisible();
  },
};

export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [PROJECTS]: runsFull, '/api/sessions?weeks=4': sessionsEmpty });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No sessions in this period.')).toBeVisible();
    await expect(canvas.getByText('0 sessions · 0 hold a run')).toBeVisible();
  },
};

/** Full: the last 4 weeks by default; opening a session lists its timeline. */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [PROJECTS]: runsFull, '/api/sessions?weeks=4': sessionsFull });
  },
  play: async ({ canvas, userEvent }) => {
    const toggle = await canvas.findByRole('button', { name: twoRunSession.title! });
    await expect(canvas.getByText('3 sessions · 1 holds a run')).toBeVisible();
    await expect(canvas.getByRole('combobox', { name: 'Period' })).toHaveValue('4');
    await userEvent.click(toggle);
    const timeline = canvas.getByRole('list', { name: `Timeline of ${twoRunSession.title}` });
    await expect(within(timeline).getAllByRole('listitem')).toHaveLength(twoRunSession.timeline.length);
    await expect(canvas.queryByText(/in other projects/)).toBeNull();
  },
};

/** "Has warnings" asks the API for the sessions with warnings only. */
export const HasWarnings: Story = {
  beforeEach: () => {
    mockApi({
      '/api/status': status,
      [PROJECTS]: runsFull,
      '/api/sessions?weeks=4': sessionsFull,
      '/api/sessions?weeks=4&warnings=1': { sessions: [twoRunSession, otherSession], hidden: 0 },
    });
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Debug the export timeout');
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Has warnings' }));
    await expect(fetch).toHaveBeenCalledWith('/api/sessions?weeks=4&warnings=1');
    await expect(await canvas.findAllByRole('row')).toHaveLength(3);
    await expect(canvas.queryByText('Debug the export timeout')).toBeNull();
  },
};

/** Showing mode on: no session ID, and the sessions of other projects only counted, under the list. */
export const HiddenSessions: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [PROJECTS]: runsFull, '/api/sessions?weeks=4': sessionsHidden });
  },
  play: async ({ canvas }) => {
    await canvas.findByRole('button', { name: twoRunSession.title! });
    await expect(canvas.queryByRole('button', { name: 'Copy session ID' })).toBeNull();
    await expect(canvas.getByText('+ 2 sessions in other projects, counted in totals and charts only')).toBeVisible();
  },
};
