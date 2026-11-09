import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { CATEGORIES, loadReport } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { importReport } from '../src/db/import.ts';
import { listUnits } from '../src/db/read.ts';
import { currentLabels, labelInputs, tokensSince, type LabelInput } from '../src/db/labels.ts';
import { labellerSettings, labelPending, type LabelClient } from '../src/labeller.ts';

const IMPORTED = new Date('2026-11-10T18:00:00Z');
const NOW = new Date('2026-11-10T20:00:00Z');
const LATER_SAME_DAY = new Date('2026-11-10T22:00:00Z');
const MODEL = 'claude-haiku-5-5';

type Item = Parameters<LabelClient>[0][number];
type Result = Awaited<ReturnType<LabelClient>>['results'][number];

const dirs: string[] = [];
const dbs: Db[] = [];

function freshDb(): Db {
  const dir = mkdtempSync(join(tmpdir(), 'cwd labeller '));
  dirs.push(dir);
  const db = openDb(join(dir, 'data dir', 'dashboard.sqlite'));
  dbs.push(db);
  return db;
}

/** A database with `raw` (a fixture, or a changed copy of one) imported as the server does. */
function imported(raw: any): Db {
  const db = freshDb();
  const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
  if (!loaded.ok) throw new Error('the fixture does not load');
  importReport(db, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, IMPORTED);
  return db;
}

/** report-projects with the plan run's findings repeated under new ids, F100 onward, until `total` have ids. */
function withFindings(total: number): any {
  const raw = fixture('report-projects');
  const steps = raw.runs.flatMap((r: any) => r.steps ?? []).filter((s: any) => s.step);
  let count = steps.flatMap((s: any) => s.findings ?? []).filter((f: any) => f.id).length;
  const run = raw.runs.find((r: any) => r.steps?.some((s: any) => s.step === 'plan_review'));
  const findings = run.steps.flatMap((s: any) => s.findings ?? []);
  for (let n = 0; count < total; n++, count++) {
    run.steps[0].findings.push({ ...findings[n % findings.length], id: `F${100 + n}` });
  }
  return raw;
}

function inputs(db: Db): LabelInput[] {
  return labelInputs(listUnits(db, 'run'));
}

function stored(db: Db): number {
  return currentLabels(db, inputs(db)).size;
}

const validAnswer = (item: Item): Result => ({
  id: item.id,
  category: CATEGORIES[item.area][0]!,
  relevance: 'valid',
  reason: 'An invented reason.',
});

/** A stub client that records each batch it is sent and answers each item with `answer`. */
function stubClient(answer: (item: Item) => Result[] = (item) => [validAnswer(item)]) {
  const batches: Item[][] = [];
  const client: LabelClient = async (batch) => {
    batches.push(batch);
    return { results: batch.flatMap(answer), inputTokens: 1000, outputTokens: 200 };
  };
  return { batches, client };
}

afterEach(() => {
  for (const db of dbs.splice(0)) db.$client.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('labelPending', () => {
  test('sends 60 pending findings in batches of 25, 25 and 10, ids f1 to f25, and stores 60 labels', async () => {
    const db = imported(withFindings(60));
    expect(inputs(db)).toHaveLength(60);
    const { batches, client } = stubClient();
    await labelPending(db, client, { model: MODEL, dailyMax: 500 }, NOW);
    expect(batches.map((b) => b.length)).toEqual([25, 25, 10]);
    expect(batches[0]!.map((i) => i.id)).toEqual(Array.from({ length: 25 }, (_, n) => `f${n + 1}`));
    expect(batches[2]!.map((i) => i.id)).toEqual(Array.from({ length: 10 }, (_, n) => `f${n + 1}`));
    expect(stored(db)).toBe(60);
    expect(tokensSince(db, IMPORTED)).toEqual({ input: 3000, output: 600 });
  });

  test('stops at the daily max, and a second run the same day stores none', async () => {
    const db = imported(withFindings(60));
    const { batches, client } = stubClient();
    await labelPending(db, client, { model: MODEL, dailyMax: 30 }, NOW);
    expect(stored(db)).toBe(30);
    await labelPending(db, client, { model: MODEL, dailyMax: 30 }, LATER_SAME_DAY);
    expect(stored(db)).toBe(30);
    expect(batches.map((b) => b.length)).toEqual([25, 5]);
  });

  test("doesn't store a category outside the finding's area", async () => {
    const db = imported(fixture('report-projects'));
    const all = inputs(db);
    const { client } = stubClient((item) => [
      item.area === 'plan' ? { ...validAnswer(item), category: 'correctness' } : validAnswer(item),
    ]);
    await labelPending(db, client, { model: MODEL, dailyMax: 500 }, NOW);
    const labels = currentLabels(db, all);
    expect(labels.size).toBe(all.filter((i) => i.area !== 'plan').length);
    for (const input of all.filter((i) => i.area === 'plan')) {
      expect(labels.has(`${input.runKey} ${input.findingId}`)).toBe(false);
    }
  });

  test('keeps the first result for an id named twice, and drops an id that was not sent', async () => {
    const db = imported(fixture('report-projects'));
    const all = inputs(db);
    const { client } = stubClient((item) => [
      validAnswer(item),
      { ...validAnswer(item), relevance: 'invalid' },
      { ...validAnswer(item), id: 'f99' },
    ]);
    await labelPending(db, client, { model: MODEL, dailyMax: 500 }, NOW);
    const labels = [...currentLabels(db, all).values()];
    expect(labels).toHaveLength(all.length);
    expect(labels.every((l) => l.relevance === 'valid')).toBe(true);
  });

  test('a throwing client stores nothing from its batch, stops, and labelPending rejects', async () => {
    const db = imported(withFindings(60));
    const { batches, client: answering } = stubClient();
    let calls = 0;
    const client: LabelClient = async (batch) => {
      if (++calls === 2) throw new Error('529 overloaded');
      return answering(batch);
    };
    await expect(labelPending(db, client, { model: MODEL, dailyMax: 500 }, NOW)).rejects.toThrow('529 overloaded');
    expect(calls).toBe(2);
    expect(batches).toHaveLength(1);
    expect(stored(db)).toBe(25);
    expect(tokensSince(db, IMPORTED)).toEqual({ input: 1000, output: 200 });
  });
});

describe('labellerSettings', () => {
  test('is null with no key', () => {
    expect(labellerSettings({})).toBeNull();
    expect(labellerSettings({ ANTHROPIC_API_KEY: '' })).toBeNull();
  });

  test('defaults the model and the daily max', () => {
    expect(labellerSettings({ ANTHROPIC_API_KEY: 'k' })).toEqual({ model: 'claude-haiku-5-5', dailyMax: 500 });
  });

  test(".env.example's empty values mean the defaults", () => {
    expect(labellerSettings({ ANTHROPIC_API_KEY: 'k', LABELLER_MODEL: '', LABELLER_DAILY_MAX: '' })).toEqual({
      model: 'claude-haiku-5-5',
      dailyMax: 500,
    });
  });

  test('reads the model and the daily max', () => {
    const env = { ANTHROPIC_API_KEY: 'k', LABELLER_MODEL: 'claude-other', LABELLER_DAILY_MAX: '40' };
    expect(labellerSettings(env)).toEqual({ model: 'claude-other', dailyMax: 40 });
  });
});
