// Runs the configured reporter once and says whether the loader reads its output: the version, the failing field
// paths, the run key counts, the weeks whose sums differ from the reporter's totals, and the leaks showing mode lets
// through. It prints no value from the data but those weeks' dates. Usage: `pnpm --filter @cwd/server check:real
// [dataDir]`; the data dir defaults to the real one.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadReport, PATHS, splitSessionId, type RunEntry, type RunsResponse } from '@cwd/shared';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { importReport } from './db/import.ts';
import { openDb } from './db/open.ts';
import { listUnits, setSeenAt, setShowing } from './db/read.ts';
import { projectKey, runKey } from './keys.ts';
import { runReporter } from './reporter.ts';
import { weekSums } from './views/home.ts';
import { storedBranches } from './views/runs.ts';
import { forbiddenStrings, leaks } from './views/scope.ts';

const config = loadConfig(process.argv[2]);
const result = await runReporter(config.reporterCommand, config.reporterTimeoutMs);
if (!result.ok) {
  // The summary only: the full error can hold stderr's last line, which may name a path or session ID.
  console.error(result.summary);
  process.exit(1);
}

const json = result.json as { version?: unknown; runs?: unknown } | null;
console.log(`version: ${typeof json?.version === 'number' ? json.version : 'none'}`);

const loaded = loadReport(result.json);
console.log(loaded.ok ? 'fields: none' : loaded.fields.join('\n'));

// Counted on the raw runs, so a bad shape elsewhere still gives the counts; a run that isn't an object has no key.
const runs = Array.isArray(json?.runs) ? (json.runs as unknown[]) : [];
const keys = runs.map((run) => (typeof run === 'object' && run !== null ? runKey(run as RunEntry) : null));
const present = keys.filter((key) => key !== null);
console.log(`run keys: ${present.length - new Set(present).size} duplicates, ${keys.length - present.length} missing`);

if (!loaded.ok) process.exitCode = 1;
else {
  // The app's week sums over the export's runs against the export's totals.weeks: runs by path, and cost to the cent.
  const sums = weekSums(loaded.report.runs);
  const weeks = loaded.report.totals.weeks ?? [];
  const cents = (cost: number | null | undefined) => (cost == null ? null : Math.round(cost * 100));
  const differ = weeks.filter((week) => {
    const sum = sums.get(week.week ?? '');
    return (
      !sum ||
      PATHS.some((path) => sum.runs[path] !== (week.runs?.[path] ?? 0)) ||
      cents(sum.cost) !== cents(week.cost)
    );
  });
  console.log(`weeks: ${weeks.length} compared, ${differ.length} differ`);
  for (const week of differ) console.log(week.week);

  // Showing mode on the first root, in a fresh database in a temp folder (never the real one): every response's
  // forbidden strings (forbiddenStrings) are counted, never printed.
  const dir = mkdtempSync(join(tmpdir(), 'cwd check real '));
  const db = openDb(join(dir, 'dashboard.sqlite'));
  try {
    importReport(db, loaded.report, result.json as { runs: unknown[]; sessions: unknown[]; totals: unknown }, new Date());
    // Everything was seen before the import, so the home feed holds every run and warning.
    setSeenAt(db, new Date(0));
    const branches = storedBranches(listUnits(db, 'run'));
    const roots = [...branches.keys()].sort();
    const shown = roots.slice(0, 1);
    setShowing(db, shown.map(projectKey));
    const { sessions, runs } = loaded.report;
    const files = [...sessions.map((s) => s.file), ...runs.map((run) => run.window?.transcript)];
    const sessionIds = files.flatMap((file) => splitSessionId(file ?? '').sessionId ?? []);
    const forbidden = forbiddenStrings(roots, branches, shown, sessionIds);
    const app = createApp({
      db,
      port: config.port,
      requestImport: () => {},
      importing: () => false,
      webDist: null,
      now: () => new Date(),
      aliases: config.aliases,
      labeller: null,
    });
    // A route's error goes to the catch below, not to Hono's log.
    app.onError((error) => {
      throw error;
    });
    const get = async (path: string) =>
      (await app.request(path, { headers: { Host: `localhost:${config.port}` } })).json();
    const list = (await get('/api/runs?weeks=52')) as RunsResponse;
    const paths = ['/api/status', '/api/showing', '/api/home', '/api/findings?weeks=52'];
    const pages = list.runs.map((run) => `/api/runs/${run.key}`);
    const bodies = [list, ...(await Promise.all([...paths, ...pages].map(get)))];
    const count = bodies.reduce((sum: number, body) => sum + leaks(body, forbidden).length, 0);
    console.log(count === 0 ? 'showing: pass' : `showing: ${count} leaks`);
    if (count > 0) process.exitCode = 1;
  } catch {
    // A fixed message: an error's text can quote the data.
    console.error('showing: the check failed');
    process.exitCode = 1;
  } finally {
    db.$client.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
