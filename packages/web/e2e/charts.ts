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
