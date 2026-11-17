import { expect, within } from 'storybook/test';

/** The text of each cell (`td`) of a table row. */
export function cells(row: HTMLElement): string[] {
  return within(row)
    .queryAllByRole('cell')
    .map((cell) => cell.textContent ?? '');
}

/** No cell, header cells included, of `el` joins several values with " · ": one value per cell. */
export async function expectNoJoined(el: Element): Promise<void> {
  const texts = [...el.querySelectorAll('td, th')].map((cell) => cell.textContent ?? '');
  await expect(texts.filter((text) => text.includes(' · '))).toEqual([]);
}

/** Every group header (a header cell spanning columns) is scoped to its column group. */
export async function expectColgroups(el: HTMLElement): Promise<void> {
  const groups = [...el.querySelectorAll('thead th[colspan]')];
  await expect(groups.length).toBeGreaterThan(0);
  for (const th of groups) await expect(th).toHaveAttribute('scope', 'colgroup');
}
