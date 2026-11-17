import type { Locator } from '@playwright/test';

/** Waits for the animations and transitions inside `locator` to end, since axe run mid-way reads their colours
 * half-way (a dialog fading in, a pressed switch's colours). */
export async function settled(locator: Locator): Promise<void> {
  await locator.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
}
