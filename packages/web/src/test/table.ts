import { expect } from 'storybook/test';

/** Every group header (a header cell spanning columns) is scoped to its column group. */
export async function expectColgroups(el: HTMLElement): Promise<void> {
  const groups = [...el.querySelectorAll('thead th[colspan]')];
  await expect(groups.length).toBeGreaterThan(0);
  for (const th of groups) await expect(th).toHaveAttribute('scope', 'colgroup');
}
