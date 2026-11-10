// The dashboard: loads the config and the data folder's `.env`, opens the database, imports on start and on each
// trigger (one at a time, through the queue), labels the findings after each import when there is a key, and serves
// the app. Usage: `pnpm --filter @cwd/server start`.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { builtWebDist, serveApp } from './app.ts';
import { loadConfig } from './config.ts';
import { rebuildDerived } from './db/import.ts';
import { openDb } from './db/open.ts';
import { lastGoodImport } from './db/read.ts';
import { anthropicLabelClient, labelPending, labellerSettings } from './labeller.ts';
import { createQueue } from './queue.ts';
import { importOnce } from './reporter.ts';
import { startTriggers } from './triggers.ts';

const config = loadConfig();
const envFile = join(config.dataDir, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const db = openDb(join(config.dataDir, 'dashboard.sqlite'));
// The derived values are rebuilt at every start, so rows stored before a new derived value gain it.
rebuildDerived(db);
const now = () => new Date();
const settings = labellerSettings(process.env);
const client = settings && anthropicLabelClient(settings.model);
const labels = settings && client ? createQueue(() => labelPending(db, client, settings, now()), 'label') : null;
const queue = createQueue(async () => {
  await importOnce(db, config, now);
  labels?.request();
});
// The last good import, not the last attempt, so a failed import doesn't hold back the transcript timer.
startTriggers(config, queue.request, () => lastGoodImport(db)?.at ?? null);
queue.request();
serveApp({
  db,
  port: config.port,
  requestImport: queue.request,
  importing: queue.busy,
  webDist: builtWebDist(),
  now,
  aliases: config.aliases,
  labeller: settings,
});
