import { expect, test } from 'vitest';
import css from '../index.css?raw';

// WCAG contrast of every ink on every surface it is drawn on, computed from the theme's tokens with plain arithmetic.
// Per mode: the backdrop colours are each gradient stop (light: --background), and each orb's colour at its opacity
// over each stop. A surface is --panel over a backdrop colour with each end of --panel-sheen over that; the header
// band adds --secondary, and `hover` adds --accent (the menu's current page, a hovered button). A table row's own
// hover is --muted at 50%, lighter than the band, so the band covers it.
// Nothing filters what is behind a panel, so these colours are the ones drawn. A panel's backdrop-filter was also
// recomputed on every scroll frame over the fixed backdrop, which made scrolling lag.

type Rgba = [number, number, number, number];

const COLOUR = /#[0-9a-f]{8}|#[0-9a-f]{6}|rgb\([^)]*\)/gi;

/** A block's custom properties (`--name: value;`), the block found by its selector at the start of a line. */
function block(selector: string): Record<string, string> {
  const body = css.match(new RegExp(`^${selector.replace('.', '\\.')} \\{([\\s\\S]*?)^\\}`, 'm'))?.[1] ?? '';
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([\s\S]*?);/g)].map(([, name, value]) => [name, value.trim()]));
}

function parse(colour: string): Rgba {
  if (colour.startsWith('#')) {
    const [r, g, b, a = 255] = [1, 3, 5, 7].map((i) => parseInt(colour.slice(i, i + 2), 16)).filter((v) => !Number.isNaN(v));
    return [r, g, b, a / 255];
  }
  const [r, g, b, a] = colour.match(/[\d.]+/g)!.map(Number);
  return [r, g, b, a ?? 1];
}

/** `top` at its opacity over the opaque `bottom`. */
const over = (top: Rgba, bottom: Rgba): Rgba => [0, 1, 2].map((i) => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1) as Rgba;

const luminance = (c: Rgba) => {
  const [r, g, b] = c.slice(0, 3).map((v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: Rgba, b: Rgba) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** The lowest contrast of `ink` over the given backgrounds. */
const worst = (ink: Rgba, backgrounds: Rgba[]) => Math.min(...backgrounds.map((b) => ratio(ink, b)));

function mode(name: string, tokens: Record<string, string>) {
  const token = (key: string): string => {
    const value = tokens[key];
    const ref = value?.match(/^var\(--([\w-]+)\)$/);
    return ref ? token(ref[1]) : value;
  };
  const colour = (key: string) => parse(token(key));
  const colours = (text: string) => (text.match(COLOUR) ?? []).map(parse);
  const backdrop = token('backdrop');
  const orbs = [...backdrop.matchAll(/radial-gradient\(([^()]|\([^)]*\))*\)/g)].flatMap(([orb]) => colours(orb));
  const linear = backdrop.match(/linear-gradient\(([^()]|\([^)]*\))*\)/)?.[0];
  const stops = linear ? colours(linear) : [colour('background')];
  const backdropColours = [...stops, ...orbs.flatMap((orb) => stops.map((stop) => over(orb, stop)))];
  const sheen = colours(token('panel-sheen'));
  const panel = backdropColours.flatMap((b) => sheen.map((end) => over(end, over(colour('panel'), b))));
  return {
    name,
    colour,
    stops,
    orbs,
    backdrop: backdropColours,
    panel,
    band: panel.map((p) => over(colour('secondary'), p)),
    hover: panel.map((p) => over(colour('accent'), p)),
    noticeBar: backdropColours.map((b) => over(colour('notice'), b)),
    // Showing mode's bar at the rail's foot: the notice over a panel.
    noticeOnPanel: panel.map((p) => over(colour('notice'), p)),
    foreground: colour('foreground'),
    mutedForeground: colour('muted-foreground'),
    warningInk: colour('warning-ink'),
    noticeInk: colour('notice-ink'),
  };
}

// `.dark` sits on the same element as `:root`, so a dark token falls back to the root's and `var()` reads dark values.
const light = mode('light', block(':root'));
const dark = mode('dark', { ...block(':root'), ...block('.dark') });

test('an 8-digit hex keeps its alpha', () => {
  expect('#11223380'.match(COLOUR)).toEqual(['#11223380']);
  expect(parse('#11223380')).toEqual([0x11, 0x22, 0x33, 0x80 / 255]);
});
test('no backdrop-filter', () => expect(css).not.toMatch(/backdrop-filter/));
test('the theme parses to the expected backdrop', () => {
  expect(dark.stops).toHaveLength(3);
  expect(dark.orbs).toHaveLength(4);
  expect(light.stops).toHaveLength(1);
  expect(light.orbs).toHaveLength(4);
});
for (const mode of [light, dark]) {
  test(`${mode.name}: primary ink on every backdrop colour`, () => expect(worst(mode.foreground, mode.backdrop)).toBeGreaterThanOrEqual(4.5));
  test.each(['panel', 'band', 'hover'] as const)(`${mode.name}: primary, secondary and warning ink on the %s`, (surface) => {
    for (const ink of [mode.foreground, mode.mutedForeground, mode.warningInk]) expect(worst(ink, mode[surface])).toBeGreaterThanOrEqual(4.5);
  });
  test(`${mode.name}: notice ink on the notice bar over every backdrop colour`, () => expect(worst(mode.noticeInk, mode.noticeBar)).toBeGreaterThanOrEqual(4.5));
  test(`${mode.name}: notice ink on the notice bar over every panel surface`, () => expect(worst(mode.noticeInk, mode.noticeOnPanel)).toBeGreaterThanOrEqual(4.5));
  // The zero step only over the panel: heatmap rows don't hover and its cells are never in the header band.
  test.each(['zero', '1', '2', '3', '4', '5'])(`${mode.name}: shade step %s's ink`, (step) => {
    const shade = mode.colour(`shade-${step}`);
    expect(worst(mode.colour(`on-shade-${step}`), mode.panel.map((p) => over(shade, p)))).toBeGreaterThanOrEqual(4.5);
  });
}
