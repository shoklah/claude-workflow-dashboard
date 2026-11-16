import { expect, test } from 'vitest';
import css from '../index.css?raw';
import { cn } from 'cn';

/** The theme's own names for a scale in `index.css`'s `@theme` (`--radius-control`, `--text-page-title`), sub-keys
 * like `--text-page-title--line-height` aside. */
function themeNames(scale: string): string[] {
  const theme = css.slice(css.indexOf('@theme inline'), css.indexOf('\n}', css.indexOf('@theme inline')));
  return [...theme.matchAll(new RegExp(`--${scale}-([a-z0-9-]+?):`, 'g'))].map((m) => m[1]).filter((n) => !n.includes('--'));
}

test('a theme radius wins over the one a shadcn component sets', () => {
  const radii = themeNames('radius');
  expect(radii).toContain('control');
  for (const radius of radii) expect(cn('rounded-md', `rounded-${radius}`)).toBe(`rounded-${radius}`);
});

test('a theme text size is a size: it replaces a size and keeps the colour', () => {
  const sizes = themeNames('text');
  expect(sizes).toContain('page-title');
  for (const size of sizes) expect(cn('text-sm text-muted-foreground', `text-${size}`)).toBe(`text-muted-foreground text-${size}`);
});
