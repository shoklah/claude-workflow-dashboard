import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { fullRun, smallRun } from '../test/runs.ts';
import { sessionsFull, twoRunSession } from '../test/sessions.ts';
import { expectColgroups, expectNoJoined } from '../test/table.ts';
import { SessionsTable } from './SessionsTable.tsx';

const meta = { component: SessionsTable } satisfies Meta<typeof SessionsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Each body cell's text in a table, one array per row, leaving out any table nested in it. */
function cells(table: Element): string[][] {
  return [...table.querySelectorAll(':scope > tbody > tr')].map((tr) =>
    [...tr.querySelectorAll(':scope > td')].map((td) => td.textContent ?? ''),
  );
}

export const Empty: Story = {
  args: { sessions: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table')).toBeVisible();
    await expect(
      canvas.getByText('No sessions in this period. A session shows here once the reporter reads its transcript.'),
    ).toBeVisible();
  },
};

/** Full: a row of counts per session; a session's name opens its timeline, a small table of its own. */
export const Full: Story = {
  args: { sessions: sessionsFull.sessions },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expectColgroups(canvasElement);
    const headers = canvas.getAllByRole('columnheader').map((th) => th.textContent);
    await expect(headers).toEqual([
      'Session',
      'ID',
      'Project',
      'Change',
      'Goal',
      'Started',
      'Length',
      'Model',
      'Effort',
      'Est. cost ($)',
      'Skills',
      'Commands',
      'Runs',
      'Startup',
      'Warnings',
      'Typed',
      'Never loaded',
    ]);
    for (const name of ['Length', 'Est. cost ($)', 'Skills', 'Typed', 'Never loaded', 'Runs', 'Warnings']) {
      await expect(canvas.getByRole('columnheader', { name })).toHaveClass('text-right', 'tabular-nums');
    }

    const rows = canvas.getAllByRole('row').slice(2);
    await expect(rows).toHaveLength(5);
    const [two, other, , long, twoModels] = rows.map((row) => within(row));

    // Lengths adapt to their size, right-aligned.
    for (const [row, length] of [
      [other, '12 min'],
      [two, '2 h 40'],
      [long, '3 d 11 h'],
    ] as const) {
      await expect(row.getByText(length).closest('td')).toHaveClass('text-right', 'tabular-nums');
    }
    await expect(two.getByText('7d1e4b2a')).toBeVisible();
    await expect(two.getByText('1.05')).toBeVisible();
    await expect(other.getByText('Other project')).toBeVisible();

    // Its change links to the change's page and its goal is named; none is the dash, read out as what it means.
    await expect(two.getByRole('link', { name: twoRunSession.change!.title })).toHaveAttribute(
      'href',
      `/work/changes/${twoRunSession.change!.key}`,
    );
    const [, , , change, goal] = other.getAllByRole('cell');
    await expect(cells(canvasElement.querySelector('table')!).at(0)!.slice(3, 5)).toEqual([
      twoRunSession.change!.title,
      twoRunSession.goal!.name,
    ]);
    await expect(within(change).getByText('no design')).toBeInTheDocument();
    await expect(within(goal).getByText('no goal')).toBeInTheDocument();

    // Two models: one per line in Model, their efforts beside them in Effort.
    const [, , , , , , , model, effort] = twoModels.getAllByRole('cell');
    await expect([...model.children].map((line) => line.textContent)).toEqual(['Opus 5.5', 'Sonnet 5.5']);
    await expect([...effort.children].map((line) => line.textContent)).toEqual(['high', '–not known']);

    // Counts: skills, commands typed, never loaded, runs; Startup in words, Missing and a non-zero Never loaded orange.
    const twoCells = cells(canvasElement.querySelector('table')!).at(0)!;
    await expect(twoCells.slice(10)).toEqual(['1', '3', '1', '2', 'Loaded', '1']);
    await expect(two.getByText('Loaded')).not.toHaveClass('text-warning-ink');
    const neverLoaded = two.getAllByRole('cell')[12];
    await expect(neverLoaded).toHaveClass('text-warning-ink');
    await expect(other.getAllByRole('cell')[12]).not.toHaveClass('text-warning-ink');
    await expect(other.getByText('Missing').closest('td')).toHaveClass('text-warning-ink');
    await expectNoJoined(canvasElement);

    // Closed, a row shows no timeline; its name is the toggle.
    await expect(canvas.queryByRole('table', { name: 'Timeline of Plan the search index' })).toBeNull();
    const toggle = canvas.getByRole('button', { name: 'Plan the search index' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    // Open, the detail row holds the timeline as a small table: one value per cell, times on the 24-hour clock.
    const timeline = canvas.getByRole('table', { name: 'Timeline of Plan the search index' });
    const inTimeline = within(timeline);
    await expect(inTimeline.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Time', 'What', 'Name', 'Outcome']);
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

    await userEvent.click(toggle);
    await expect(canvas.queryByRole('table', { name: 'Timeline of Plan the search index' })).toBeNull();
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

/** Open: its rows start open, as the Sessions view lists one session from a link. */
export const Open: Story = {
  args: { sessions: [twoRunSession], open: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: twoRunSession.title! })).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByRole('table', { name: `Timeline of ${twoRunSession.title}` })).toBeVisible();
  },
};
