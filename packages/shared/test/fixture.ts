import { readFileSync } from 'node:fs';

/** A fixture's parsed JSON, read fresh each call so a test can change it. */
export function fixture(name: string): any {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'));
}
