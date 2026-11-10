// The dashboard on invented data, for the frontend's tests: a temp data dir, each named fixture imported in order an
// hour apart (the first is the baseline, so the feed shows what the later ones add), labels.json's invented labels,
// a fixed clock, a reporter that prints the last fixture again, no triggers and the labeller off. Usage:
// `pnpm --filter @cwd/server dev:fixtures [fixture...]` (default report-full report-later report-v5); the port is the
// config's default unless PORT is set.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, type Relevance } from '@cwd/shared';
import { builtWebDist, serveApp } from './app.ts';
import { loadConfig } from './config.ts';
import { labelInputs, saveBatch } from './db/labels.ts';
import { openDb } from './db/open.ts';
import { lastImport, listUnits } from './db/read.ts';
import { createQueue } from './queue.ts';
import { importOnce } from './reporter.ts';

const NOW = new Date('2026-11-12T12:00:00Z');
const HOUR = 60 * 60 * 1000;

const names = process.argv.length > 2 ? process.argv.slice(2) : ['report-full', 'report-later', 'report-v5'];
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

// Each label names its run by date and branch; one that matches no stored finding, or whose category isn't in the
// finding's area, stops here, so a stale labels.json can't leave the pages unlabelled unnoticed.
type FixtureLabel = {
  date: string;
  branch: string;
  findingId: string;
  category: string;
  relevance: Relevance;
  reason: string;
};
const labelsFile = fileURLToPath(new URL('../../shared/fixtures/labels.json', import.meta.url));
const fixtureLabels: FixtureLabel[] = JSON.parse(readFileSync(labelsFile, 'utf8'));
const runs = listUnits(db, 'run');
const inputs = labelInputs(runs);
const labels = fixtureLabels.map(({ date, branch, findingId, category, relevance, reason }) => {
  const run = runs.find((r) => r.merged.record?.date === date && r.merged.record?.branch === branch);
  const input = inputs.find((i) => i.runKey === run?.key && i.findingId === findingId);
  if (!input) throw new Error(`labels.json: no finding ${findingId} in the run of ${date} on ${branch}`);
  if (!CATEGORIES[input.area].includes(category)) throw new Error(`labels.json: ${category} isn't a ${input.area} category`);
  const { runKey, hash } = input;
  return { runKey, findingId, hash, model: 'fixture', category, relevance, reason, labelledAt: NOW };
});
saveBatch(db, labels, { at: NOW, inputTokens: 0, outputTokens: 0 });

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
  labeller: null,
});
