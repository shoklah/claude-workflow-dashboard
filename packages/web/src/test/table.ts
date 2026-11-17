import { createElement } from 'react';
import type { Decorator } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

/** A story in a box of a set width, for a list whose fold follows its own container. */
export const width =
  (px: number): Decorator =>
  (Story) =>
    createElement('div', { style: { width: px } }, createElement(Story));

/** The visible elements of one tag in an opened row, as text: both its narrow and its wide facts are in the page. */
const visible = (row: HTMLElement, tag: string) =>
  [...row.querySelectorAll<HTMLElement>(tag)].filter((el) => el.checkVisibility()).map((el) => el.textContent);
/** An opened row's visible terms. */
export const visibleTerms = (row: HTMLElement) => visible(row, 'dt');
/** An opened row's visible values. */
export const visibleValues = (row: HTMLElement) => visible(row, 'dd');
/** An opened row's visible value (`dd`) for a term. */
export const visibleFact = (row: HTMLElement, term: string) =>
  [...row.querySelectorAll<HTMLElement>('dt')].find((el) => el.checkVisibility() && el.textContent === term)!
    .nextElementSibling as HTMLElement;

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
