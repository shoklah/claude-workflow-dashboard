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

/** Full: the last 4 weeks by default, a goal to choose from; opening a session shows its timeline; the notes fold under
 * the table; a view of the Work page, so it has no page title of its own. */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [PROJECTS]: runsFull, '/api/sessions?weeks=4': sessionsFull });
  },
  play: async ({ canvas, userEvent }) => {
    const toggle = await canvas.findByRole('button', { name: twoRunSession.title! });
    await expect(canvas.queryByRole('heading', { level: 1 })).toBeNull();
    await expect(canvas.getByRole('combobox', { name: 'Period' })).toHaveValue('4');
    const goals = canvas.getByRole('combobox', { name: 'Goal' });
    await expect([...goals.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['All', twoRunSession.goal!.name]);
    await expect(canvas.queryByText(/^Session: /)).toBeNull();
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
    // Two header rows and a row per session.
    await expect(await canvas.findAllByRole('row')).toHaveLength(4);
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

/** The goal filter goes to the API as a query param. */
export const GoalFilter: Story = {
  beforeEach: () => {
    mockApi({
      '/api/status': status,
      [PROJECTS]: runsFull,
      '/api/sessions?weeks=4': sessionsFull,
      [`/api/sessions?weeks=4&goal=${twoRunSession.goal!.key}`]: { ...sessionsFull, sessions: [twoRunSession] },
    });
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Debug the export timeout');
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Goal' }), twoRunSession.goal!.name);
    await expect(fetch).toHaveBeenCalledWith(`/api/sessions?weeks=4&goal=${twoRunSession.goal!.key}`);
    await expect(await canvas.findAllByRole('row')).toHaveLength(3);
  },
};

const ONE = `/api/sessions?weeks=4&session=${twoRunSession.key}`;

/** A link to one session: it alone, its row open, under a chip naming it whose link clears it. */
export const OneSession: Story = {
  args: { session: twoRunSession.key },
  beforeEach: () => {
    mockApi({ '/api/status': status, [PROJECTS]: runsFull, [ONE]: { ...sessionsFull, sessions: [twoRunSession] } });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(`Session: ${twoRunSession.title}`)).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Clear the session filter' })).toHaveAttribute('href', '/work?view=sessions');
    // One session's row and its open timeline's row.
    const list = canvas.getByRole('region', { name: 'Sessions' }).querySelector('table')!;
    await expect(list.querySelectorAll(':scope > tbody > tr')).toHaveLength(2);
    await expect(canvas.getByRole('button', { name: twoRunSession.title! })).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByRole('table', { name: `Timeline of ${twoRunSession.title}` })).toBeVisible();
  },
};

/** A link to a session that isn't listed (gone, or hidden by showing mode): none, and a line saying so; the chip still
 * clears it. */
export const UnknownSession: Story = {
  args: { session: '0000000000000000' },
  beforeEach: () => {
    mockApi({ '/api/status': status, [PROJECTS]: runsFull, '/api/sessions?weeks=4&session=0000000000000000': sessionsEmpty });
  },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText("This session isn't listed: it isn't in the data any more, or showing mode hides it."),
    ).toBeVisible();
    await expect(canvas.getByText('Session: not found')).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Clear the session filter' })).toHaveAttribute('href', '/work?view=sessions');
    await expect(canvas.queryByRole('region', { name: 'Sessions' })).toBeNull();
  },
};
