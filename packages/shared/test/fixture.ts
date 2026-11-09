import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** A fixture's file path, for a test that hands the file itself to a command. */
export function fixturePath(name: string): string {
  return fileURLToPath(new URL(`../fixtures/${name}.json`, import.meta.url));
}

/** A fixture's parsed JSON, read fresh each call so a test can change it. */
export function fixture(name: string): any {
  return JSON.parse(readFileSync(fixturePath(name), 'utf8'));
}
