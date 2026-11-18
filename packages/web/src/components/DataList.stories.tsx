import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Num } from './Num.tsx';
import { visibleTerms, visibleValues, width, openedRow } from '../test/table.ts';
import { DataList, type ListColumn, type ListFact } from './DataList.tsx';

/** An invented item. */
type Item = { key: string; name: string; count: number | null; when: string };

// 24 items: two with no count (Item 4, Item 16), two named "Twin" with the lowest counts.
const ROWS: Item[] = Array.from({ length: 24 }, (_, i) => ({
  key: `k${i + 1}`,
  name: i === 4 || i === 5 ? 'Twin' : `Item ${i + 1}`,
  count: i === 3 || i === 15 ? null : i === 4 || i === 5 ? i - 3 : ((i * 7) % 24) + 3,
  when: `Nov ${i + 1}`,
}));

const NAME: ListColumn<Item> = { id: 'name', header: 'Name', value: (r) => r.name, cell: (r) => r.name, text: (r) => r.name, wide: true };
const COUNT: ListColumn<Item> = { id: 'count', header: 'Count', value: (r) => r.count, cell: (r) => <Num value={r.count} />, num: true };
const WHEN: ListColumn<Item> = { id: 'when', header: 'When', value: (r) => r.when, cell: (r) => r.when, fold: true };
const FACTS: ListFact<Item>[] = [
  ['Key', (r) => r.key],
  ['Note', () => null],
];

const meta = {
  component: DataList<Item>,
  args: {
    rows: ROWS,
    rowKey: (r) => r.key,
    name: (r) => r.name,
    columns: [NAME, COUNT, WHEN],
    facts: FACTS,
    label: 'Items',
    empty: 'Nothing here.',
  },
} satisfies Meta<typeof DataList<Item>>;
export default meta;
type Story = StoryObj<typeof meta>;

const bodyRows = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('tbody > tr')];
/** The text of each body row's cell in column `i`. */
const column = (el: HTMLElement, i: number) => bodyRows(el).map((tr) => tr.querySelectorAll('td')[i]?.textContent ?? '');

/** Empty: the list's own empty line in its one row, and no pages. */
export const Empty: Story = {
  args: { rows: [] },
  play: async ({ canvas, canvasElement }) => {
    await expect(column(canvasElement, 0)).toEqual(['Nothing here.']);
    await expect(canvas.queryByRole('navigation')).toBeNull();
  },
};

/** No empty line: a list given none shows its headers alone. */
export const NoEmptyLine: Story = {
  args: { rows: [], empty: undefined },
  play: async ({ canvasElement }) => {
    await expect(bodyRows(canvasElement)).toHaveLength(0);
  },
};

/** Short: ten rows, all shown, no pages. */
export const Short: Story = {
  args: { rows: ROWS.slice(0, 10) },
  play: async ({ canvas, canvasElement }) => {
    await expect(bodyRows(canvasElement)).toHaveLength(10);
    await expect(canvas.queryByRole('navigation')).toBeNull();
  },
};

/** Pages: 24 rows, ten at a time, with the range and Previous and Next, each disabled at its end. */
export const Pages: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const nav = within(canvas.getByRole('navigation', { name: 'Items pages' }));
    await expect(nav.getByText('1–10 of 24')).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await userEvent.click(nav.getByRole('button', { name: 'Next' }));
    await userEvent.click(nav.getByRole('button', { name: 'Next' }));
    await expect(nav.getByText('21–24 of 24')).toBeVisible();
    await expect(bodyRows(canvasElement)).toHaveLength(4);
    await expect(nav.getByRole('button', { name: 'Next' })).toBeDisabled();
    await expect(nav.getByRole('button', { name: 'Previous' })).toBeEnabled();
  },
};

/** Sorts: a header click sorts ascending, then descending, then back to the given order; unknown counts last. */
export const Sorts: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const head = canvas.getByRole('columnheader', { name: 'Count' });
    const sort = within(head).getByRole('button', { name: 'Count' });
    const nav = within(canvas.getByRole('navigation', { name: 'Items pages' }));
    const counts = () => column(canvasElement, 1).map(Number);
    // From page 2, a sort shows page 1.
    await userEvent.click(nav.getByRole('button', { name: 'Next' }));
    await userEvent.click(sort);
    await expect(head).toHaveAttribute('aria-sort', 'ascending');
    await expect(nav.getByText('1–10 of 24')).toBeVisible();
    await expect(counts()).toEqual([...counts()].sort((a, b) => a - b));
    await expect(counts()[0]).toBe(1);
    await userEvent.click(nav.getByRole('button', { name: 'Next' }));
    await userEvent.click(nav.getByRole('button', { name: 'Next' }));
    await expect(column(canvasElement, 0).slice(-2).sort()).toEqual(['Item 16', 'Item 4']);
    await userEvent.click(sort);
    await expect(head).toHaveAttribute('aria-sort', 'descending');
    await expect(nav.getByText('1–10 of 24')).toBeVisible();
    await expect(counts()).toEqual([...counts()].sort((a, b) => b - a));
    await userEvent.click(nav.getByRole('button', { name: 'Next' }));
    await userEvent.click(nav.getByRole('button', { name: 'Next' }));
    await expect(column(canvasElement, 0).slice(-2).sort()).toEqual(['Item 16', 'Item 4']);
    await userEvent.click(sort);
    await expect(head).not.toHaveAttribute('aria-sort');
    await expect(column(canvasElement, 0)).toEqual(ROWS.slice(0, 10).map((r) => r.name));
  },
};

/** One sort at a time: a shift-click on a second header sorts by it alone. */
export const OneSort: Story = {
  play: async ({ canvas, userEvent }) => {
    const name = canvas.getByRole('columnheader', { name: 'Name' });
    const count = canvas.getByRole('columnheader', { name: 'Count' });
    await userEvent.click(within(name).getByRole('button', { name: 'Name' }));
    await userEvent.keyboard('{Shift>}');
    await userEvent.click(within(count).getByRole('button', { name: 'Count' }));
    await userEvent.keyboard('{/Shift}');
    await expect(count).toHaveAttribute('aria-sort', 'ascending');
    await expect(name).not.toHaveAttribute('aria-sort');
  },
};

/** The column that names the row (`names`) is medium, and a row's name takes its own class (`textClass`): an unnamed
 * one regular and muted. */
export const Names: Story = {
  args: {
    columns: [
      { ...NAME, names: true, textClass: (r) => r.count === null && 'font-normal text-muted-foreground' },
      COUNT,
      WHEN,
    ],
  },
  play: async ({ canvas }) => {
    const named = canvas.getByRole('button', { name: 'Item 1' });
    await expect(named.closest('td')).toHaveClass('font-medium');
    await expect(named.lastElementChild).not.toHaveClass('text-muted-foreground');
    await expect(canvas.getByRole('button', { name: 'Item 4' }).lastElementChild).toHaveClass('font-normal', 'text-muted-foreground');
    await expect(named.closest('tr')!.querySelectorAll('td')[1]).not.toHaveClass('font-medium');
  },
};

/** Opens in place: a row opens to its facts, a null one left out; rows open independently and stay open by key. */
export const OpensInPlace: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const first = canvas.getByRole('button', { name: 'Item 1' });
    await expect(first).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(first);
    await expect(first).toHaveAttribute('aria-expanded', 'true');
    const opened = openedRow(first);
    await expect(visibleTerms(opened)).toContain('Key');
    await expect(visibleValues(opened)).toContain('k1');
    await expect(within(opened).queryByText('Note')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Item 2' }));
    await expect(first).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByRole('button', { name: 'Item 2' })).toHaveAttribute('aria-expanded', 'true');
    // Close both, open the second twin, then sort: only that twin stays open.
    await userEvent.click(first);
    await userEvent.click(canvas.getByRole('button', { name: 'Item 2' }));
    await userEvent.click(canvas.getAllByRole('button', { name: 'Twin' })[1]);
    await userEvent.click(canvas.getByRole('button', { name: 'Count' }));
    const open = canvas.getAllByRole('button', { expanded: true });
    await expect(open).toHaveLength(1);
    const row = openedRow(open[0]);
    await expect(visibleValues(row)).toContain('k6');
    await expect(bodyRows(canvasElement).filter((tr) => tr.textContent?.includes('k5'))).toHaveLength(0);
  },
};

/** A new set of rows goes back to page 1. */
export const RowsChangeResetsPage: Story = {
  render: function Render(args) {
    const [rows, setRows] = useState(ROWS);
    return (
      <>
        <button type="button" onClick={() => setRows(ROWS.slice(0, 4))}>
          Four rows
        </button>
        <DataList {...args} rows={rows} />
      </>
    );
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const nav = within(canvas.getByRole('navigation', { name: 'Items pages' }));
    await userEvent.click(nav.getByRole('button', { name: 'Next' }));
    await userEvent.click(nav.getByRole('button', { name: 'Next' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Four rows' }));
    await expect(bodyRows(canvasElement)).toHaveLength(4);
    await expect(canvas.queryByRole('navigation')).toBeNull();
  },
};

/** The same rows in a new array keep the page. */
export const SameRowsKeepPage: Story = {
  render: function Render(args) {
    const [rows, setRows] = useState(ROWS);
    return (
      <>
        <button type="button" onClick={() => setRows(ROWS.map((r) => ({ ...r })))}>
          Same rows
        </button>
        <DataList {...args} rows={rows} />
      </>
    );
  },
  play: async ({ canvas, userEvent }) => {
    const nav = within(canvas.getByRole('navigation', { name: 'Items pages' }));
    await userEvent.click(nav.getByRole('button', { name: 'Next' }));
    await expect(nav.getByText('11–20 of 24')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Same rows' }));
    await expect(nav.getByText('11–20 of 24')).toBeVisible();
  },
};

/** Narrow: under 768 px of its own width the fold column moves to the top of the opened row; wider, it shows. */
export const Narrow: Story = {
  render: (args) => (
    <div className="flex flex-col gap-6">
      <div data-testid="narrow" style={{ width: 375 }}>
        <DataList {...args} />
      </div>
      <div data-testid="wide" style={{ width: 1000 }}>
        <DataList {...args} />
      </div>
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    const narrow = within(canvas.getByTestId('narrow'));
    await expect(narrow.getByText('When').closest('th')).not.toBeVisible();
    await expect(narrow.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(narrow.getByRole('columnheader', { name: 'Count' })).toBeVisible();
    await userEvent.click(narrow.getByRole('button', { name: 'Item 1' }));
    const narrowOpened = openedRow(narrow.getByRole('button', { name: 'Item 1' }));
    await expect(visibleTerms(narrowOpened)).toEqual(['When', 'Key']);

    const wide = within(canvas.getByTestId('wide'));
    await expect(wide.getByRole('columnheader', { name: 'When' })).toBeVisible();
    await userEvent.click(wide.getByRole('button', { name: 'Item 1' }));
    const wideOpened = openedRow(wide.getByRole('button', { name: 'Item 1' }));
    await expect(visibleTerms(wideOpened)).toEqual(['Key']);
  },
};

/** A first cell that is a link gets a chevron button of its own before it; a row whose name is text gets `RowToggle`. */
export const LinkFirst: Story = {
  args: {
    columns: [
      {
        ...NAME,
        text: (r) => (r.count === null ? r.name : null),
        cell: (r) => (r.count === null ? r.name : <a href="#item">{r.name}</a>),
      },
      COUNT,
    ],
  },
  play: async ({ canvas }) => {
    const toggle = canvas.getByRole('button', { name: 'Details of Item 1' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const link = canvas.getByRole('link', { name: 'Item 1' });
    await expect(link).not.toContainElement(toggle);
    await expect(toggle).not.toContainElement(link);
    await expect(canvas.getByRole('button', { name: 'Item 4' })).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.queryByRole('button', { name: 'Details of Item 4' })).toBeNull();
  },
};

/** A folding first column: the toggle is the first column that shows, and the folded column tops the opened row. */
export const FoldedFirst: Story = {
  args: { columns: [WHEN, NAME, COUNT] },
  decorators: [width(375)],
  play: async ({ canvas, userEvent }) => {
    const toggle = canvas.getByRole('button', { name: 'Item 1' });
    await expect(toggle.closest('td')).toBe(toggle.closest('tr')!.querySelectorAll('td')[1]);
    await userEvent.click(toggle);
    const opened = openedRow(toggle);
    await expect(visibleTerms(opened)[0]).toBe('When');
  },
};

/** Folded columns its only details: the toggle shows only while they fold, and opens to them. */
export const FoldOnly: Story = {
  args: { facts: [] },
  render: (args) => (
    <div className="flex flex-col gap-6">
      <div data-testid="narrow" style={{ width: 375 }}>
        <DataList {...args} />
      </div>
      <div data-testid="wide" style={{ width: 1000 }}>
        <DataList {...args} />
      </div>
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    const wide = within(canvas.getByTestId('wide'));
    await expect(wide.queryAllByRole('button', { expanded: false })).toHaveLength(0);
    await expect(wide.getAllByText('Item 1').filter((el) => el.checkVisibility())).toHaveLength(1);
    const narrow = within(canvas.getByTestId('narrow'));
    const toggle = narrow.getByRole('button', { name: 'Item 1' });
    await expect(toggle).toBeVisible();
    await userEvent.click(toggle);
    const opened = openedRow(toggle);
    await expect(visibleTerms(opened)).toEqual(['When']);
  },
};

/** A refetch with fewer rows from a later page never paints that page: the first render shows page 1. */
export const NoStalePage: Story = {
  render: function Render(args) {
    const [rows, setRows] = useState(ROWS);
    return (
      <>
        <button type="button" onClick={() => setTimeout(() => setRows(ROWS.slice(0, 15)))}>
          Fifteen rows later
        </button>
        <DataList {...args} rows={rows} />
      </>
    );
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const nav = within(canvas.getByRole('navigation', { name: 'Items pages' }));
    await userEvent.click(nav.getByRole('button', { name: 'Next' }));
    await userEvent.click(nav.getByRole('button', { name: 'Next' }));
    const seen: string[] = [];
    const observer = new MutationObserver(() => {
      seen.push(`${bodyRows(canvasElement).length} ${canvasElement.querySelector('nav span')?.textContent ?? ''}`);
    });
    observer.observe(canvasElement, { subtree: true, childList: true, characterData: true });
    await userEvent.click(canvas.getByRole('button', { name: 'Fifteen rows later' }));
    await expect(nav.getByText('1–10 of 15')).toBeVisible();
    observer.disconnect();
    await expect(seen.filter((s) => !s.endsWith('1–10 of 15') && !s.endsWith('21–24 of 24'))).toEqual([]);
  },
};
