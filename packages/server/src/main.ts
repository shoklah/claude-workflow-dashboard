// The dashboard: loads the config, opens the database, imports on start and on each trigger (one at a time, through
// the queue) and serves the app. Usage: `pnpm --filter @cwd/server start`.
import { join } from 'node:path';
import { builtWebDist, serveApp } from './app.ts';
import { loadConfig } from './config.ts';
import { openDb } from './db/open.ts';
import { lastGoodImport } from './db/read.ts';
import { createQueue } from './queue.ts';
import { importOnce } from './reporter.ts';
import { startTriggers } from './triggers.ts';

const config = loadConfig();
const db = openDb(join(config.dataDir, 'dashboard.sqlite'));
const now = () => new Date();
const queue = createQueue(() => importOnce(db, config, now));
// The last good import, not the last attempt, so a failed import doesn't hold back the transcript timer.
startTriggers(config, queue.request, () => lastGoodImport(db)?.at ?? null);
queue.request();
serveApp({ db, port: config.port, requestImport: queue.request, importing: queue.busy, webDist: builtWebDist(), now });
