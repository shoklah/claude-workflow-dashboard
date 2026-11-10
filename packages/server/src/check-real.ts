// Runs the configured reporter once and says whether the loader reads its output: the version, the failing field
// paths, the run key counts, the weeks, run time groups, step kinds and rules whose sums differ from the reporter's
// totals, the count of skills and of models that differ, and the leaks showing mode lets through. It prints no value
// from the data but those weeks' dates, and no skill or agent name, since a project can name one. Usage:
// `pnpm --filter @cwd/server check:real [dataDir]`; the data dir defaults to the real one.
import { mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
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
import { modelSums } from './views/models.ts';
import { storedBranches } from './views/runs.ts';
import { forbiddenStrings, leaks } from './views/scope.ts';
import { skillSums } from './views/skills.ts';
import { ruleSums, stepSums } from './views/steps.ts';
import { runTime } from './views/weeks.ts';

type Counts = Record<string, number | null | undefined> | null | undefined;

/** The keys of the records, each once. */
const keysOf = (...records: (object | null | undefined)[]) => [
  ...new Set(records.flatMap((record) => Object.keys(record ?? {}))),
];

/** Whether two counts agree on every key, a missing or null count being 0. */
const sameCounts = (a: Counts, b: Counts) => keysOf(a, b).every((key) => (a?.[key] ?? 0) === (b?.[key] ?? 0));

/** A cost to the cent, null when unknown. */
const cents = (cost: number | null | undefined) => (cost == null ? null : Math.round(cost * 100));

/**
 * A figure's line: how many of its keys differ, then, when named, their names (never a value); null differ when the
 * export's totals lack the figure (the old reporter's).
 */
function differLine(label: string, compared: string, differ: string[] | null, named = true): void {
  if (differ === null) return console.log(`${label}: not in the export`);
  console.log(`${label}: ${compared}${differ.length} differ`);
  if (named) for (const key of differ) console.log(key);
}

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
  const { runs: entries, sessions: sessionEntries, totals } = loaded.report;
  // The app's week sums over the export's runs against the export's totals.weeks, every field, cost to the cent.
  const sums = weekSums(entries);
  const weeks = totals.weeks ?? [];
  const differ = weeks.filter((week) => {
    const sum = sums.get(week.week ?? '');
    return (
      !sum ||
      PATHS.some((path) => sum.runs[path] !== (week.runs?.[path] ?? 0)) ||
      !sameCounts(sum.findings, week.findings) ||
      !sameCounts(
        { tasks: sum.tasks, fix_rounds: sum.fixRounds, stops: sum.stops, later_fixes: sum.laterFixes },
        { tasks: week.tasks, fix_rounds: week.fix_rounds, stops: week.stops, later_fixes: week.later_fixes },
      ) ||
      sum.fablePoints !== (week.fable_points ?? null) ||
      sum.allPoints !== (week.all_points ?? null) ||
      sum.minutesPerRun !== (week.minutes_per_run ?? null) ||
      cents(sum.cost) !== cents(week.cost)
    );
  });
  console.log(`weeks: ${weeks.length} compared, ${differ.length} differ`);
  for (const week of differ) console.log(week.week);

  // The other pages' sums over every run (and session, for skills) of the export against its all-time totals.
  const time = runTime(entries);
  const groups = [
    ['with_waves', time.withWaves],
    ['without_waves', time.withoutWaves],
  ] as const;
  const runTimes = totals.run_time;
  differLine(
    'run time',
    'compared, ',
    runTimes
      ? groups
          .filter(([name, got]) => {
            const want = runTimes[name];
            return (
              !sameCounts({ runs: got.runs, timed: got.timed }, { runs: want?.runs, timed: want?.timed }) ||
              got.medianMinutes !== (want?.median_minutes ?? null)
            );
          })
          .map(([name]) => name)
      : null,
  );

  const board = totals.scoreboard;
  const steps = stepSums(entries);
  differLine(
    'steps',
    `${steps.length} compared, `,
    board
      ? steps
          .filter((row) => {
            const want = board[row.step];
            const out = (...keys: string[]) => keys.reduce((n, key) => n + (want?.outcomes?.[key] ?? 0), 0);
            return (
              !want ||
              !sameCounts(
                { ran: row.ran, found: row.found, fixed: row.fixedOrApplied, declined: row.declined },
                { ran: want.ran, found: want.found, fixed: out('fixed', 'applied'), declined: out('declined') },
              ) ||
              !sameCounts(
                { deferred: row.deferred, open: row.openOrToOwner },
                { deferred: out('deferred'), open: out('open', 'to_owner') },
              ) ||
              !sameCounts(row.counts, want.counts) ||
              (row.tokens === null) !== (want.tokens == null) ||
              !sameCounts(row.tokens, want.tokens) ||
              cents(row.cost) !== cents(want.cost)
            );
          })
          .map((row) => row.step)
      : null,
  );

  const rules = ruleSums(entries);
  const sameOffers = keysOf(rules.offers, totals.offers).every((skill) =>
    sameCounts(rules.offers[skill], totals.offers?.[skill]),
  );
  differLine(
    'rules',
    '',
    board
      ? Object.entries({
          failing_test: sameCounts(rules.failingTest, board.failing_test),
          fix_round_cap: sameCounts(rules.fixRoundCap, board.fix_round_cap),
          stop_rule: rules.stopRule === (board.stop_rule?.stops ?? 0),
          offers: sameOffers,
        })
          .filter(([, same]) => !same)
          .map(([name]) => name)
      : null,
  );

  // A skill required but never loaded (no runs, no last load) has only the reporter's missing count, which skillSums
  // doesn't sum, so it isn't compared.
  const skills = new Map(skillSums([...entries, ...sessionEntries]).map((row) => [row.name, row]));
  const skillTotals = totals.skills;
  const everLoaded = Object.entries(skillTotals ?? {}).filter(([, row]) => row.runs || row.last);
  const skillNames = [...new Set([...skills.keys(), ...everLoaded.map(([name]) => name)])];
  differLine(
    'skills',
    `${skillNames.length} compared, `,
    skillTotals
      ? skillNames.filter((name) => {
          const [got, want] = [skills.get(name), skillTotals[name]];
          return (got?.runs ?? 0) !== (want?.runs ?? 0) || (got?.last ?? null) !== (want?.last ?? null);
        })
      : null,
    false,
  );

  const models = modelSums(entries);
  const modelTotals = totals.models;
  differLine(
    'models',
    '',
    modelTotals
      ? [
          ...keysOf(models.agents, modelTotals.agents).filter((name) => {
            const [got, want] = [models.agents[name], modelTotals.agents?.[name]];
            return !sameCounts(got?.requested, want?.requested) || !sameCounts(got?.actual, want?.actual);
          }),
          ...PATHS.filter((path) => !sameCounts(models.main[path], modelTotals.main?.[path]?.actual)),
        ]
      : null,
    false,
  );

  // Showing mode on the first root, in a fresh database in a temp folder (never the real one): every response's
  // forbidden strings (forbiddenStrings, and the home folder) are counted, never printed.
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
    const files = [...sessionEntries.map((s) => s.file), ...entries.map((run) => run.window?.transcript)];
    const sessionIds = files.flatMap((file) => splitSessionId(file ?? '').sessionId ?? []);
    // The home folder too, so any path under it is a leak.
    const strings = forbiddenStrings(roots, branches, shown, sessionIds);
    const forbidden = [...strings.forbidden, homedir()];
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
    const paths = [
      '/api/status',
      '/api/showing',
      '/api/home',
      '/api/findings?weeks=52',
      '/api/weeks?weeks=52',
      '/api/steps?weeks=52',
      '/api/skills?weeks=52',
      '/api/models?weeks=52',
      '/api/compliance?resolved=1&weeks=52',
    ];
    const pages = list.runs.map((run) => `/api/runs/${run.key}`);
    const bodies = [list, ...(await Promise.all([...paths, ...pages].map(get)))];
    const count = bodies.reduce((sum: number, body) => sum + leaks(body, forbidden, strings.shown).length, 0);
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
