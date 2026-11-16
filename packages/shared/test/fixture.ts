import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** A fixture's file path, for a test that hands the file itself to a command. */
export function fixturePath(name: string): string {
  return fileURLToPath(new URL(`../fixtures/${name}.json`, import.meta.url));
}

/** A fixture's parsed JSON, read fresh each call so a test can change it. */
export function fixture(name: string): any {
  return JSON.parse(readFileSync(fixturePath(name), 'utf8'));
}

/** The names of the reporter export fixtures (`report-*.json`), for a test that covers every one. */
export function reportFixtures(): string[] {
  return readdirSync(fileURLToPath(new URL('../fixtures/', import.meta.url)))
    .filter((file) => file.startsWith('report-') && file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length));
}
