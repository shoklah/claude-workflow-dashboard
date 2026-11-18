// The dashboard on invented data, for the frontend's tests: a temp data dir, each named fixture imported in order an
// hour apart (the first is the baseline, so the feed shows what the later ones add), labels.json's invented labels,
// a fixed clock, a reporter that prints the last fixture again, no triggers and the labeller off. Usage:
// `pnpm --filter @cwd/server dev:fixtures [fixture...]` (default report-full report-later report-v6 report-v7
// report-work); the port is the config's default unless PORT is set. With `DEV_MODE=hosted` it serves hosted mode on
// `localhost:<port>` instead, the fixtures imported into account 1's file, and a stub GitHub that signs in at once as
// account 1, `rowan-k`, the admin; account 2, `mika-ito`, invited, holds the same fixtures, keeps lantern-notes as its
// one shown project and grants `rowan-k` a view.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Relevance } from '@cwd/shared';
import { builtWebDist, serveApp } from './app.ts';
import { addInvite, addViewer, signInAccount } from './hosted/accounts.ts';
import { hostedDeps } from './hosted/main.ts';
import { activeList, inArea } from './categories.ts';
import { loadConfig } from './config.ts';
import { labelInputs, saveBatch } from './db/labels.ts';
import { openDb } from './db/open.ts';
import { lastImport, listUnits, setShownProjects } from './db/read.ts';
import type { Db } from './db/open.ts';
import { projectKey } from './keys.ts';
import { createQueue } from './queue.ts';
import { importOnce } from './reporter.ts';

const NOW = new Date('2026-11-12T12:00:00Z');
const HOUR = 60 * 60 * 1000;

const names =
  process.argv.length > 2
    ? process.argv.slice(2)
    : ['report-full', 'report-later', 'report-v6', 'report-v7', 'report-work'];
const files = names.map((name) => fileURLToPath(new URL(`../../shared/fixtures/${name}.json`, import.meta.url)));
const dataDir = mkdtempSync(join(tmpdir(), 'cwd fixtures '));
const base = loadConfig(dataDir);
const port = process.env.PORT ? Number(process.env.PORT) : base.port;
const hosted =
  process.env.DEV_MODE === 'hosted'
    ? hostedDeps({
        dataDir,
        port,
        publicHost: `localhost:${port}`,
        origin: `http://localhost:${port}`,
        admin: 'rowan-k',
        github: {
          authorizeUrl: (state, redirectUri) => `${redirectUri}?code=dev&state=${encodeURIComponent(state)}`,
          user: async () => ({ id: 1, login: 'rowan-k' }),
        },
        webDist: builtWebDist(),
        now: () => NOW,
        // An invented secret, and no label job: the labeller stays off.
        secret: Buffer.alloc(32, 1),
        requestLabels: () => {},
      })
    : null;
const db = hosted ? hosted.hosted.files.db(1) : openDb(join(dataDir, 'dashboard.sqlite'));

/** Imports the named fixtures into `into`, an hour apart, the last an hour before NOW. */
async function importFixtures(into: Db) {
  for (const [i, file] of files.entries()) {
    const at = new Date(NOW.getTime() - (files.length - i) * HOUR);
    await importOnce(into, { ...base, reporterCommand: ['sh', '-c', 'cat "$0"', file] }, () => at);
    const result = lastImport(into);
    if (!result?.ok) throw new Error(`fixture ${names[i]} did not import: ${result?.error}`);
  }
}
await importFixtures(db);

if (hosted) {
  const { accounts, admin, files: accountFiles } = hosted.hosted;
  addInvite(accounts, 'mika-ito', NOW);
  signInAccount(accounts, { id: 2, login: 'mika-ito' }, admin, NOW);
  addViewer(accounts, 2, 'rowan-k');
  const mika = accountFiles.db(2);
  await importFixtures(mika);
  setShownProjects(mika, [projectKey('/Users/example/Work/lantern-notes')]);
}

// Each label names its run by date and branch and is saved under the active list (the last fixture's); one that matches
// no stored finding, or whose category isn't one of the list's ids for the finding's area, stops here, so a stale
// labels.json can't leave the pages unlabelled unnoticed.
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
const list = activeList(db);
if (!list) throw new Error(`labels.json: fixture ${names.at(-1)} has no category list`);
const runs = listUnits(db, 'run');
const inputs = labelInputs(runs);
const labels = fixtureLabels.map(({ date, branch, findingId, category, relevance, reason }) => {
  const run = runs.find((r) => r.merged.record?.date === date && r.merged.record?.branch === branch);
  const input = inputs.find((i) => i.runKey === run?.key && i.findingId === findingId);
  if (!input) throw new Error(`labels.json: no finding ${findingId} in the run of ${date} on ${branch}`);
  if (!inArea(list, input.area, category)) {
    throw new Error(`labels.json: ${category} isn't a ${input.area} category`);
  }
  const { runKey, hash } = input;
  return { runKey, findingId, hash, model: 'fixture', category, relevance, reason, labelledAt: NOW };
});
saveBatch(db, labels, { at: NOW, inputTokens: 0, outputTokens: 0 }, list.number);

if (hosted) serveApp(hosted);
else {
  const config = { ...base, reporterCommand: ['sh', '-c', 'cat "$0"', files.at(-1)!] };
  const queue = createQueue(() => importOnce(db, config, () => NOW));
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
}
