import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { loadReport, projectRoot, type SkillsResponse } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { createApp } from '../src/app.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { importReport } from '../src/db/import.ts';
import { listUnits, setShowing } from '../src/db/read.ts';
import { projectKey } from '../src/keys.ts';
import { forbiddenStrings, leaks } from '../src/views/scope.ts';
import { skillSums } from '../src/views/skills.ts';

const PORT = 4317;
const NOW = new Date('2026-11-12T12:00:00Z');

// report-v5's projects: every skill load is in the week of 2026-11-08, the session's included.
const LANTERN = '/Users/example/Work/lantern-notes';
const TIDEPOOL = '/Users/example/Work/tidepool-api';

let dir: string;
let db: Db;

/** A fresh database in the test's folder, holding a fixture's import (report-v5 by default), changed first by
 * `change`. */
function dbWith(name: string, change: (raw: any) => void = () => {}, report = 'report-v5'): Db {
  const fresh = openDb(join(dir, name, 'dashboard.sqlite'));
  const raw = fixture(report);
  change(raw);
  const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
  if (!loaded.ok) throw new Error(`${report} does not load`);
  importReport(fresh, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, NOW);
  return fresh;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cwd skills '));
  db = dbWith('plain');
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

async function skills(query = ''): Promise<SkillsResponse> {
  const app = createApp({
    db,
    port: PORT,
    requestImport: () => {},
    importing: () => false,
    webDist: null,
    now: () => NOW,
    aliases: {},
    labeller: null,
  });
  const res = await app.request(`/api/skills${query}`, { headers: { Host: `localhost:${PORT}` } });
  expect(res.status).toBe(200);
  return res.json();
}

/** Every stored run's and session's entry. */
const units = () => [...listUnits(db, 'run'), ...listUnits(db, 'session')].map((unit) => unit.merged);

const byName = <T extends { name: string }>(rows: T[]) => new Map(rows.map((row) => [row.name, row]));

test("skillSums over every stored run and session gives the reporter's runs and last load for each skill", () => {
  const totals = fixture('report-v5').totals.skills;
  const rows = skillSums(units());
  expect(rows.map((row) => row.name).sort()).toEqual(Object.keys(totals).sort());
  for (const row of rows) {
    expect({ name: row.name, runs: row.runs, last: row.last }).toEqual({
      name: row.name,
      runs: totals[row.name].runs,
      last: totals[row.name].last,
    });
  }
});

test("skillSums counts a skill's loads by skillOutcomeLabel, and a unit that loads it twice once in runs", () => {
  const rows = byName(skillSums(units()));
  expect(rows.get('subagent-driven-development')?.outcomes).toEqual({ ran: 2, 'record written': 1 });
  expect(rows.get('simplify')?.outcomes).toEqual({ 'applied 2, skipped 1': 1, 'applied 1, skipped 1': 1 });
  expect(rows.get('brainstorming')?.outcomes).toEqual({ 'wrote a file': 1 });

  const twice = skillSums([
    {
      skills: [
        { name: 'simplify', time: '2026-11-10T15:00:00Z', outcome: 'ran' },
        { name: 'simplify', time: '2026-11-10T16:00:00Z', outcome: 'ran' },
      ],
    },
  ]);
  expect(twice).toEqual([{ name: 'simplify', runs: 1, last: '2026-11-10T16:00:00Z', outcomes: { ran: 2 } }]);
});

test("the Skills page lists the period's skills by name, each with the reporter's all-time missing count", async () => {
  const body = await skills();
  expect(body.skills.map((row) => row.name)).toEqual([
    'brainstorming',
    'graphify',
    'simplify',
    'subagent-driven-development',
    'test-driven-development',
    'writing-plans',
  ]);
  expect(byName(body.skills).get('subagent-driven-development')).toEqual({
    name: 'subagent-driven-development',
    runs: 3,
    last: '2026-11-12T02:41:05.512Z',
    outcomes: { ran: 2, 'record written': 1 },
    missing: 0,
  });
  expect(body.missingSource).toBe('reporter');
});

test('a skill required but missing that no unit loaded in the period still has its row, with no loads', async () => {
  db.$client.close();
  db = dbWith('never loaded', (raw) => {
    // A typed grill-me never loaded, as skill_totals counts it: no runs, no last load.
    raw.totals.skills['grill-me'] = { runs: 0, last: null, outcomes: {}, missing: 2 };
  });
  const body = await skills();
  expect(body.skills.map((row) => row.name).slice(0, 3)).toEqual(['brainstorming', 'graphify', 'grill-me']);
  expect(byName(body.skills).get('grill-me')).toEqual({ name: 'grill-me', runs: 0, last: null, outcomes: {}, missing: 2 });
});

test("a load outside the period's weeks doesn't count", async () => {
  db.$client.close();
  db = dbWith('old loads', (raw) => {
    // The session's load and the plan run's brainstorming load, moved to the week of 2026-09-27.
    raw.sessions[0].skills[0].time = '2026-10-01T09:00:00Z';
    raw.runs[3].skills[0].time = '2026-10-01T08:00:00Z';
  });
  const rows = byName((await skills()).skills);
  expect(rows.get('subagent-driven-development')).toMatchObject({ runs: 2, outcomes: { ran: 1, 'record written': 1 } });
  expect(rows.has('brainstorming')).toBe(false);
  expect(rows.has('writing-plans')).toBe(true);
  const longer = byName((await skills('?weeks=12')).skills);
  expect(longer.get('subagent-driven-development')?.runs).toBe(3);
  expect(longer.get('brainstorming')?.last).toBe('2026-10-01T08:00:00Z');
});

test('the path and project filters choose the runs; every session still counts', async () => {
  // The small runs: tidy-imports, with no skills, and the one that loaded test-driven-development.
  expect((await skills('?path=small')).skills).toEqual([
    { name: 'subagent-driven-development', runs: 1, last: '2026-11-10T09:07:15.118Z', outcomes: { ran: 1 }, missing: 0 },
    { name: 'test-driven-development', runs: 1, last: '2026-11-12T08:52:10.090Z', outcomes: { ran: 1 }, missing: 0 },
  ]);
  const tidepool = byName((await skills(`?project=${projectKey(TIDEPOOL)}`)).skills);
  expect([...tidepool.keys()]).toEqual(['graphify', 'simplify', 'subagent-driven-development']);
  expect(tidepool.get('subagent-driven-development')?.runs).toBe(2);
});

test("missing is null when the last export's totals have no skills", async () => {
  db.$client.close();
  db = dbWith('old reporter', () => {}, 'report-full');
  const body = await skills();
  expect(body.skills.length).toBeGreaterThan(0);
  expect(body.skills.every((row) => row.missing === null)).toBe(true);
});

test("with showing on, the sums count every project and hold no hidden project's name, path or branch", async () => {
  const raw = fixture('report-v5');
  const branches = new Map<string, string[]>();
  for (const run of raw.runs) {
    const root = projectRoot(run.record.project);
    branches.set(root, [...(branches.get(root) ?? []), run.record.branch]);
  }
  const sessionIds = [
    ...new Set(JSON.stringify(raw).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)),
  ];
  const strings = forbiddenStrings([...branches.keys()], branches, [LANTERN], sessionIds);
  expect(strings.forbidden).toContain('feature/webhooks');
  expect(strings.forbidden).toContain('tidepool-api');
  db.$client.close();
  db = dbWith('showing', (raw) => {
    // A project-local skill named after the hidden tidepool-api: loaded by its webhooks run, and missing in another.
    raw.runs[5].skills[1].name = 'tidepool-api-release';
    raw.totals.skills['tidepool-api-release'] = { runs: 1, last: raw.runs[5].skills[1].time, missing: 1 };
  });
  setShowing(db, [projectKey(LANTERN)]);
  const body = await skills('?weeks=52');
  expect(byName(body.skills).get('another project-release')).toMatchObject({ runs: 1, missing: 1 });
  expect(byName(body.skills).get('subagent-driven-development')?.runs).toBe(3);
  expect(leaks(body, [...strings.forbidden, '/Users/example'], strings.shown)).toEqual([]);
});
