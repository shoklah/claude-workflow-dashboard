// The dashboard on invented data, for the frontend's tests: a temp data dir, each named fixture imported in order an
// hour apart (the first is the baseline, so the feed shows what the later ones add), a fixed clock, a reporter that
// prints the last fixture again, and no triggers. Usage: `pnpm --filter @cwd/server dev:fixtures [fixture...]`
// (default report-full report-later); the port is the config's default unless PORT is set.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { builtWebDist, serveApp } from './app.ts';
import { loadConfig } from './config.ts';
import { openDb } from './db/open.ts';
import { lastImport } from './db/read.ts';
import { createQueue } from './queue.ts';
import { importOnce } from './reporter.ts';

const NOW = new Date('2026-11-12T12:00:00Z');
const HOUR = 60 * 60 * 1000;

const names = process.argv.length > 2 ? process.argv.slice(2) : ['report-full', 'report-later'];
const files = names.map((name) => fileURLToPath(new URL(`../../shared/fixtures/${name}.json`, import.meta.url)));
const dataDir = mkdtempSync(join(tmpdir(), 'cwd fixtures '));
const db = openDb(join(dataDir, 'dashboard.sqlite'));
const base = loadConfig(dataDir);

for (const [i, file] of files.entries()) {
  const at = new Date(NOW.getTime() - (files.length - i) * HOUR);
  await importOnce(db, { ...base, reporterCommand: ['cat', file] }, () => at);
  const result = lastImport(db);
  if (!result?.ok) throw new Error(`fixture ${names[i]} did not import: ${result?.error}`);
}

const config = { ...base, reporterCommand: ['cat', files.at(-1)!] };
const queue = createQueue(() => importOnce(db, config, () => NOW));
const port = process.env.PORT ? Number(process.env.PORT) : config.port;
serveApp({
  db,
  port,
  requestImport: queue.request,
  importing: queue.busy,
  webDist: builtWebDist(),
  now: () => NOW,
  aliases: config.aliases,
});
