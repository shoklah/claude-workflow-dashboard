import { expect, type Locator } from '@playwright/test';

/** Each of `charts` labels the latest week, `latest`'s text (the table view's first week), once and whole inside its
 * box. */
export async function expectLatestWeekWhole(charts: Locator, latest: Locator): Promise<void> {
  const week = await latest.textContent();
  for (const chart of await charts.all()) {
    const box = (await chart.boundingBox())!;
    const label = chart.locator('svg text', { hasText: new RegExp(`^${week}$`) });
    await expect(label).toHaveCount(1);
    const labelBox = (await label.boundingBox())!;
    expect(labelBox.x).toBeGreaterThanOrEqual(box.x);
    expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(box.x + box.width);
  }
}

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** `chart`'s legend, labelled `names`, is clear: every label whole (inside the chart, no legend swatch over it) and over none of the week
 * labels, `weeks`, and its first line close under them, so the room under the plot holds only the legend's lines. */
export async function expectLegendClear(chart: Locator, weeks: string[], names: string[]): Promise<void> {
  const { legend, labels, swatches, svgBox } = await chart.locator('svg').evaluate(
    (svg, { weeks, names }) => {
      const box = (el: Element) => {
        const { x, y, width, height } = el.getBoundingClientRect();
        return { x, y, width, height };
      };
      const texts = [...svg.querySelectorAll('text')];
      const legend = texts.filter((t) => names.includes(t.textContent ?? '')).map(box);
      const labels = texts.filter((t) => weeks.includes(t.textContent ?? '')).map(box);
      // A legend swatch: a small mark on a legend label's line.
      const swatches = [...svg.querySelectorAll('path')]
        .map(box)
        .filter((p) => p.width > 0 && p.width <= 14 && p.height <= 14)
        .filter((p) => legend.some((l) => Math.abs(p.y + p.height / 2 - (l.y + l.height / 2)) < 3));
      return { legend, labels, swatches, svgBox: box(svg) };
    },
    { weeks, names },
  );
  expect(legend).toHaveLength(names.length);
  expect(swatches).toHaveLength(names.length);
  expect(labels.length).toBeGreaterThan(0);
  for (const item of legend) {
    expect(item.x + item.width).toBeLessThanOrEqual(svgBox.x + svgBox.width);
    for (const swatch of swatches) expect(overlaps(item, swatch)).toBe(false);
    for (const label of labels) expect(overlaps(item, label)).toBe(false);
  }
  const labelsBottom = Math.max(...labels.map((l) => l.y + l.height));
  expect(Math.min(...legend.map((l) => l.y)) - labelsBottom).toBeLessThanOrEqual(16);
}
