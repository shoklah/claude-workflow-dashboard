import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { fullRun, smallRun } from '../test/runs.ts';
import { sessionsFull } from '../test/sessions.ts';
import { expectNoJoined } from '../test/table.ts';
import { SessionsTable } from './SessionsTable.tsx';

/** The list in a box 1000 px wide, so its container is past the fold. */
const wide: Decorator = (Story) => (
  <div style={{ width: 1000 }}>
    <Story />
  </div>
);

const meta = { component: SessionsTable, decorators: [wide] } satisfies Meta<typeof SessionsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Each body cell's text in a table, one array per row, leaving out any table nested in it. */
function cells(table: Element): string[][] {
  return [...table.querySelectorAll(':scope > tbody > tr')].map((tr) =>
    [...tr.querySelectorAll(':scope > td')].map((td) => td.textContent ?? ''),
  );
}

/** The opened row under a toggle. */
const openedRow = (toggle: HTMLElement) => toggle.closest('tr')!.nextElementSibling as HTMLElement;
/** An opened row's visible terms. */
const terms = (row: HTMLElement) =>
  [...row.querySelectorAll<HTMLElement>('dt')].filter((el) => el.checkVisibility()).map((el) => el.textContent);
/** An opened row's visible value for a term. */
const fact = (row: HTMLElement, term: string) =>
  [...row.querySelectorAll<HTMLElement>('dt')].find((el) => el.checkVisibility() && el.textContent === term)!
    .nextElementSibling as HTMLElement;

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
    await expect(canvas.queryByRole('table', { name: 'Timeline of Plan the search index' })).toBeNull();
    const toggle = canvas.getByRole('button', { name: 'Plan the search index' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    // Open: its facts, in words and counts, Startup in words and a non-zero Never loaded orange.
    const opened = openedRow(toggle);
    await expect(terms(opened)).toEqual(['ID', 'Model', 'Effort', 'Skills', 'Commands typed', 'Never loaded', 'Runs', 'Startup']);
    await expect(within(fact(opened, 'ID')).getByText('7d1e4b2a')).toBeVisible();
    await expect(fact(opened, 'Model').textContent).toBe('Opus 5.5');
    await expect(fact(opened, 'Effort').textContent).toBe('medium');
    await expect(['Skills', 'Commands typed', 'Never loaded', 'Runs', 'Startup'].map((t) => fact(opened, t).textContent)).toEqual([
      '1',
      '3',
      '1',
      '2',
      'Loaded',
    ]);
    await expect(fact(opened, 'Never loaded').firstElementChild).toHaveClass('text-warning-ink');
    await expect(fact(opened, 'Startup').firstElementChild).not.toHaveClass('text-warning-ink');

    // Then the timeline as a small table in its own scrolling region: one value per cell, times on the 24-hour clock.
    await expect(canvas.getByRole('region', { name: 'Timeline of Plan the search index table' })).toBeVisible();
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
    await expectNoJoined(canvasElement);

    await userEvent.click(toggle);
    await expect(canvas.queryByRole('table', { name: 'Timeline of Plan the search index' })).toBeNull();

    // Missing startup is orange, a zero Never loaded isn't.
    const otherToggle = canvas.getByRole('button', { name: 'no title' });
    await userEvent.click(otherToggle);
    const otherOpened = openedRow(otherToggle);
    await expect(fact(otherOpened, 'Startup').firstElementChild).toHaveClass('text-warning-ink');
    await expect(fact(otherOpened, 'Startup').textContent).toBe('Missing');
    await expect(fact(otherOpened, 'Never loaded').firstElementChild).not.toHaveClass('text-warning-ink');

    // Two models: one per line in Model, their efforts beside them in Effort; an unknown startup is left out.
    const twoModels = canvas.getByRole('button', { name: 'Sketch the retry backoff' });
    await userEvent.click(twoModels);
    const twoOpened = openedRow(twoModels);
    await expect([...fact(twoOpened, 'Model').children].map((line) => line.textContent)).toEqual(['Opus 5.5', 'Sonnet 5.5']);
    await expect([...fact(twoOpened, 'Effort').children].map((line) => line.textContent)).toEqual(['high', '–not known']);
    await expect(terms(twoOpened)).not.toContain('Startup');
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
