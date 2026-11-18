import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { parseTime } from '@cwd/shared';
import { formatDayTime } from '../lib/format.ts';
import { fullRun, smallRun } from '../test/runs.ts';
import { otherSession, sessionsFull, twoRunSession } from '../test/sessions.ts';
import { expectNoJoined, visibleFact, visibleTerms, width, openedRow } from '../test/table.ts';
import { SessionsTable } from './SessionsTable.tsx';

const meta = { component: SessionsTable, decorators: [width(1000)] } satisfies Meta<typeof SessionsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The timeline's name: its session's name and start. */
const TIMELINE = `Timeline of Plan the search index, ${formatDayTime(parseTime(twoRunSession.start))}`;

/** Each body cell's text in a table, one array per row, leaving out any table nested in it. */
function cells(table: Element): string[][] {
  return [...table.querySelectorAll(':scope > tbody > tr')].map((tr) =>
    [...tr.querySelectorAll(':scope > td')].map((td) => td.textContent ?? ''),
  );
}

/** The opened row under a toggle. */

export const Empty: Story = {
  args: { sessions: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table')).toBeVisible();
    await expect(
      canvas.getByText('No sessions in this period. A session shows here once the reporter reads its transcript.'),
    ).toBeVisible();
  },
};

/** Full: a session's first glance; its title opens its facts, then its timeline, a small table of its own. */
export const Full: Story = {
  args: { sessions: sessionsFull.sessions },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const headers = canvas.getAllByRole('columnheader');
    await expect(headers.map((th) => th.textContent)).toEqual([
      'Session',
      'Project',
      'Started',
      'Length',
      'Est. cost ($)',
      'Warnings',
    ]);
    for (const th of headers) await expect(th).toBeVisible();
    for (const name of ['Length', 'Est. cost ($)', 'Warnings']) {
      await expect(canvas.getByRole('columnheader', { name })).toHaveClass('text-right', 'tabular-nums');
    }

    const rows = canvas.getAllByRole('row').slice(1);
    await expect(rows).toHaveLength(5);
    const [two, other, quiet, long] = rows.map((row) => within(row));

    // Lengths adapt to their size, right-aligned.
    for (const [row, length] of [
      [other, '12 min'],
      [two, '2 h 40'],
      [long, '3 d 11 h'],
    ] as const) {
      await expect(row.getByText(length).closest('td')).toHaveClass('text-right', 'tabular-nums');
    }
    await expect(two.getByText('1.05')).toBeVisible();
    await expect(other.getByText('Other project')).toBeVisible();
    // A non-zero Warnings count is orange.
    await expect(two.getAllByRole('cell')[5].firstElementChild).toHaveClass('text-warning-ink');
    await expect(quiet.getAllByRole('cell')[5].firstElementChild).not.toHaveClass('text-warning-ink');
    await expectNoJoined(canvasElement);

    // Closed, a row shows no facts or timeline; its title is the toggle.
    await expect(canvas.queryByRole('table', { name: TIMELINE })).toBeNull();
    const toggle = canvas.getByRole('button', { name: 'Plan the search index' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    // Open: its facts, in words and counts, Startup in words and a non-zero Never loaded orange.
    const opened = openedRow(toggle);
    await expect(visibleTerms(opened)).toEqual(['ID', 'Model', 'Effort', 'Skills', 'Commands typed', 'Never loaded', 'Runs', 'Startup']);
    await expect(within(visibleFact(opened, 'ID')).getByText('7d1e4b2a')).toBeVisible();
    await expect(visibleFact(opened, 'Model').textContent).toBe('Opus 5.5');
    await expect(visibleFact(opened, 'Effort').textContent).toBe('medium');
    await expect(['Skills', 'Commands typed', 'Never loaded', 'Runs', 'Startup'].map((t) => visibleFact(opened, t).textContent)).toEqual([
      '1',
      '3',
      '1',
      '2',
      'Loaded',
    ]);
    await expect(visibleFact(opened, 'Never loaded').firstElementChild).toHaveClass('text-warning-ink');
    await expect(visibleFact(opened, 'Startup').firstElementChild).not.toHaveClass('text-warning-ink');

    // Then the timeline as a small table in its own scrolling region: one value per cell, times on the 24-hour clock.
    await expect(canvas.getByRole('region', { name: `${TIMELINE} table` })).toBeVisible();
    const timeline = canvas.getByRole('table', { name: TIMELINE });
    const inTimeline = within(timeline);
    await expect(inTimeline.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Time', 'What', 'Name', 'Outcome']);
    // Muted column heads (`ColumnHead`), the body cells padded as they are.
    for (const th of inTimeline.getAllByRole('columnheader')) await expect(th).toHaveClass('px-2', 'py-1.5', 'text-muted-foreground');
    for (const td of inTimeline.getAllByRole('cell')) await expect(td).toHaveClass('px-2', 'py-1.5');
    const lines = cells(timeline);
    await expect(lines).toHaveLength(6);
    await expect(lines[0][0]).toMatch(/^Nov \d{1,2}, \d{2}:\d{2}$/);
    for (const line of lines) for (const cell of line) await expect(cell).not.toMatch(/AM|PM| · /);
    await expect(lines[0].slice(1)).toEqual(['Skill loaded', 'brainstorming', 'wrote a file']);
    await expect(lines[1].slice(1, 3)).toEqual(['Command typed', '/graphify']);
    await expect(lines[2].slice(1)).toEqual(['Command typed', '/grill-me', 'Its skill never loaded']);
    await expect(inTimeline.getByText('Its skill never loaded').closest('td')).toHaveClass('text-warning-ink');
    await expect(lines[3].slice(1, 3)).toEqual(['Run started', 'feat/search']);
    await expect(inTimeline.getByRole('link', { name: 'feat/search' })).toHaveAttribute('href', `/runs/${fullRun.key}`);
    await expect(inTimeline.getByRole('link', { name: 'fix/retry' })).toHaveAttribute('href', `/runs/${smallRun.key}`);
    await expectNoJoined(canvasElement);

    await userEvent.click(toggle);
    await expect(canvas.queryByRole('table', { name: TIMELINE })).toBeNull();

    // Missing startup is orange, a zero Never loaded isn't.
    const otherToggle = canvas.getByRole('button', { name: 'no title' });
    await userEvent.click(otherToggle);
    const otherOpened = openedRow(otherToggle);
    await expect(visibleFact(otherOpened, 'Startup').firstElementChild).toHaveClass('text-warning-ink');
    await expect(visibleFact(otherOpened, 'Startup').textContent).toBe('Missing');
    await expect(visibleFact(otherOpened, 'Never loaded').firstElementChild).not.toHaveClass('text-warning-ink');

    // Two models: one per line in Model, their efforts beside them in Effort; an unknown startup is left out.
    const twoModels = canvas.getByRole('button', { name: 'Sketch the retry backoff' });
    await userEvent.click(twoModels);
    const twoOpened = openedRow(twoModels);
    await expect([...visibleFact(twoOpened, 'Model').children].map((line) => line.textContent)).toEqual(['Opus 5.5', 'Sonnet 5.5']);
    await expect([...visibleFact(twoOpened, 'Effort').children].map((line) => line.textContent)).toEqual(['high', '–not known']);
    await expect(visibleTerms(twoOpened)).not.toContain('Startup');
  },
};

/** A session with nothing in its timeline says so when opened. */
export const EmptyTimeline: Story = {
  args: { sessions: sessionsFull.sessions },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Release checklist draft' }));
    await expect(canvas.getByText('No skill loads, commands or runs in this session.')).toBeVisible();
  },
};

/** Two sessions of one title, and two untitled, opened at once: each timeline's region has a name of its own. */
export const SameNames: Story = {
  args: {
    sessions: [
      twoRunSession,
      { ...twoRunSession, key: 'e1e2d3c4b5a69788', start: '2026-11-11T14:20:00Z' },
      otherSession,
      { ...otherSession, key: 'b9b8c7d6e5f40312', start: '2026-11-09T07:45:00Z' },
    ],
  },
  play: async ({ canvas, userEvent }) => {
    for (const name of ['Plan the search index', 'no title']) {
      for (const toggle of canvas.getAllByRole('button', { name })) await userEvent.click(toggle);
    }
    const names = canvas
      .getAllByRole('region')
      .map((region) => region.getAttribute('aria-label'))
      .filter((name) => name?.startsWith('Timeline of'));
    await expect(names).toHaveLength(4);
    await expect(new Set(names).size).toBe(4);
  },
};
