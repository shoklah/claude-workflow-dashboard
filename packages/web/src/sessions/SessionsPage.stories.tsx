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
    const state = await canvas.findByText('Loading the sessions…');
    await expect(state).toBeVisible();
    await expect(state.closest('.glass')).not.toBeNull();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [PROJECTS]: runsFull, '/api/sessions?weeks=4': 500 });
  },
  play: async ({ canvas }) => {
    const state = await canvas.findByText(
      "Couldn't load the sessions. Check that the dashboard server is running, then refresh.",
    );
    await expect(state).toBeVisible();
    await expect(state.closest('.glass')).not.toBeNull();
  },
};

export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [PROJECTS]: runsFull, '/api/sessions?weeks=4': sessionsEmpty });
  },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText('No sessions in this period. A session shows here once the reporter reads its transcript.'),
    ).toBeVisible();
  },
};

/** Full: the last 4 weeks by default; opening a session shows its timeline; the notes fold under the table. */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [PROJECTS]: runsFull, '/api/sessions?weeks=4': sessionsFull });
  },
  play: async ({ canvas, userEvent }) => {
    const toggle = await canvas.findByRole('button', { name: twoRunSession.title! });
    await expect(canvas.getByRole('heading', { name: 'Sessions', level: 1 })).toBeVisible();
    await expect(canvas.getByRole('combobox', { name: 'Period' })).toHaveValue('4');
    await userEvent.click(toggle);
    const timeline = canvas.getByRole('table', { name: `Timeline of ${twoRunSession.title}` });
    await expect(within(timeline).getAllByRole('row').slice(1)).toHaveLength(twoRunSession.timeline.length);
    await expect(canvas.queryByText(/in other projects/)).toBeNull();
    const notes = canvas.getByText('How sessions are listed').closest('details')!;
    await expect(notes).not.toHaveAttribute('open');
    await expect(canvas.getByRole('region', { name: 'Sessions' }).compareDocumentPosition(notes)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
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
    // A header row and a row per session.
    await expect(await canvas.findAllByRole('row')).toHaveLength(3);
    await expect(canvas.queryByText('Debug the export timeout')).toBeNull();
  },
};

/** Showing mode on: no session ID, and the sessions of other projects only counted, under the list. */
export const HiddenSessions: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [PROJECTS]: runsFull, '/api/sessions?weeks=4': sessionsHidden });
  },
  play: async ({ canvas, userEvent }) => {
    // Opened, the row leaves the hidden ID out: no chip, no ID term.
    const toggle = await canvas.findByRole('button', { name: twoRunSession.title! });
    await userEvent.click(toggle);
    const opened = toggle.closest('tr')!.nextElementSibling as HTMLElement;
    await expect(within(opened).getAllByText('Runs')[0]).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Copy session ID' })).toBeNull();
    await expect(within(opened).queryAllByText('ID')).toEqual([]);
    await expect(canvas.getByText('+ 2 sessions in other projects, counted in totals and charts only')).toBeVisible();
  },
};
