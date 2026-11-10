import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { loadReport } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { importReport } from '../src/db/import.ts';
import { hash } from '../src/keys.ts';
import { listUnits } from '../src/db/read.ts';
import { activeList } from '../src/categories.ts';
import { findingsView } from '../src/views/findings.ts';
import {
  currentLabels,
  findingKey,
  labelInputs,
  labelledOn,
  pendingInputs,
  saveBatch,
  tokensSince,
  type LabelInput,
  type StoredLabel,
} from '../src/db/labels.ts';

const FIRST = new Date('2026-11-10T18:00:00Z');
const LATER = new Date('2026-11-12T10:00:00Z');
const LABELLED = new Date('2026-11-10T23:30:00Z');
const MODEL = 'claude-haiku-5-5';
const SUMMARY = 'Unused import left in the search module';
// report-v5's category list, CR10's version 1.
const LIST = 101;

const dirs: string[] = [];
const dbs: Db[] = [];

function freshDb(): Db {
  const dir = mkdtempSync(join(tmpdir(), 'cwd labels '));
  dirs.push(dir);
  const db = openDb(join(dir, 'data dir', 'dashboard.sqlite'));
  dbs.push(db);
  return db;
}

/** Imports a fixture's JSON (a fixture, or a changed copy of one) as the server does. */
function importRaw(db: Db, raw: any, at: Date): void {
  const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
  if (!loaded.ok) throw new Error('the fixture does not load');
  importReport(db, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, at);
}

function inputs(db: Db): LabelInput[] {
  return labelInputs(listUnits(db, 'run'));
}

function labelFor(input: LabelInput): StoredLabel {
  return {
    runKey: input.runKey,
    findingId: input.findingId,
    hash: input.hash,
    model: MODEL,
    category: 'conventions',
    relevance: 'valid',
    reason: 'An invented reason.',
    labelledAt: LABELLED,
  };
}

/** A database with report-v5 imported and the finding SUMMARY labelled under its list, with the label and its input. */
function labelled(): { db: Db; input: LabelInput; label: StoredLabel } {
  const db = freshDb();
  importRaw(db, fixture('report-v5'), FIRST);
  const input = inputs(db).find((i) => i.text.includes(SUMMARY))!;
  const label = labelFor(input);
  saveBatch(db, [label], { at: LABELLED, inputTokens: 1200, outputTokens: 300 }, LIST);
  return { db, input, label };
}

const keyOf = (i: LabelInput) => findingKey(i.runKey, i.findingId);

afterEach(() => {
  for (const db of dbs.splice(0)) db.$client.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('labelInputs', () => {
  test('leaves out the finding with no id', () => {
    const db = freshDb();
    importRaw(db, fixture('report-projects'), FIRST);
    const all = inputs(db);
    expect(all).toHaveLength(11);
    expect(all.some((i) => i.text.includes('Retry count is logged twice'))).toBe(false);
  });

  test('holds no absolute path, and each hash is of its text', () => {
    const db = freshDb();
    importRaw(db, fixture('report-projects'), FIRST);
    const all = inputs(db);
    expect(all.some((i) => i.text.includes('sync.ts'))).toBe(true);
    for (const input of all) expect(input.text).not.toContain('/Users/');
    for (const input of all) expect(input.hash).toBe(hash(input.text));
  });

  test("each input carries its step's area", () => {
    const db = freshDb();
    importRaw(db, fixture('report-projects'), FIRST);
    const all = inputs(db);
    expect(all.find((i) => i.text.includes(SUMMARY))!.area).toBe('implementation');
    expect(all.find((i) => i.text.includes('re-export barrel'))!.area).toBe('cleanup');
    expect(all.find((i) => i.text.includes('export-to-PDF'))!.area).toBe('plan');
  });
});

describe('activeList', () => {
  test("after importing report-v5 it is the workflow's list 1 as number 101, with code_facts in its plan list", () => {
    const db = freshDb();
    importRaw(db, fixture('report-v5'), FIRST);
    const list = activeList(db)!;
    expect(list.number).toBe(101);
    expect(list.areas.plan.map((c) => c.id)).toContain('code_facts');
    expect(list.areas.plan.find((c) => c.id === 'task_split')?.label).toBe('Task split and order');
    expect(list.areas.cleanup).toEqual(list.areas.implementation);
    expect(list.rule).toMatch(/^Name the problem, not its fix\./);
    expect(list.validity.invalid).toBe("The problem isn't there, or the reviewer misread the brief or the code.");
  });

  test('is null on report-full alone, which has no category list', () => {
    const db = freshDb();
    importRaw(db, fixture('report-full'), FIRST);
    expect(activeList(db)).toBeNull();
  });

  test('is null with no import', () => {
    expect(activeList(freshDb())).toBeNull();
  });
});

describe('stored labels', () => {
  test('a saved label is current, and pending only for another model', () => {
    const { db, input, label } = labelled();
    const all = inputs(db);
    expect(currentLabels(db, all, LIST).get(keyOf(input))).toEqual(label);
    expect(currentLabels(db, all, LIST).size).toBe(1);
    expect(pendingInputs(db, all, MODEL, LIST).map(keyOf)).not.toContain(keyOf(input));
    expect(pendingInputs(db, all, MODEL, LIST)).toHaveLength(all.length - 1);
    expect(pendingInputs(db, all, 'claude-other-model', LIST).map(keyOf)).toContain(keyOf(input));
  });

  test('a changed summary drops the label and makes the finding pending again', () => {
    const { db, input } = labelled();
    const raw = fixture('report-v5');
    for (const run of raw.runs) {
      for (const step of run.steps ?? []) {
        for (const f of step.findings ?? []) if (f.summary === SUMMARY) f.summary = `${SUMMARY}, still`;
      }
    }
    importRaw(db, raw, LATER);
    const all = inputs(db);
    expect(currentLabels(db, all, LIST).has(keyOf(input))).toBe(false);
    expect(pendingInputs(db, all, MODEL, LIST).map(keyOf)).toContain(keyOf(input));
  });

  test("a label saved under list 1 no longer shows once list 101 is active: its finding is unlabelled and pending", () => {
    const db = freshDb();
    importRaw(db, fixture('report-full'), FIRST);
    const input = inputs(db).find((i) => i.text.includes(SUMMARY))!;
    saveBatch(db, [labelFor(input)], { at: LABELLED, inputTokens: 0, outputTokens: 0 }, 1);
    importRaw(db, fixture('report-v5'), LATER);
    const list = activeList(db)!;
    const all = inputs(db);
    // The finding's text is the same, and its list 1 label keeps its row.
    expect(all.find((i) => keyOf(i) === keyOf(input))?.hash).toBe(input.hash);
    expect(currentLabels(db, all, 1).has(keyOf(input))).toBe(true);
    const labels = currentLabels(db, all, list.number);
    expect(labels.has(keyOf(input))).toBe(false);
    expect(pendingInputs(db, all, MODEL, list.number).map(keyOf)).toContain(keyOf(input));
    const view = findingsView({
      runs: listUnits(db, 'run'),
      labels,
      list,
      query: { weeks: 52 },
      now: LATER,
      scope: null,
      labeller: { on: false, labelled: 0, waiting: 0, tokensThisWeek: { input: 0, output: 0 } },
    });
    const item = view.findings.find((f) => f.runKey === input.runKey && f.id === input.findingId);
    expect(item).toMatchObject({ area: 'implementation', category: null });
    expect(view.rows.find((r) => r.area === 'implementation' && r.category === null)).toBeDefined();
  });

  test('labelledOn counts a label on its UTC day and not the next', () => {
    const { db } = labelled();
    expect(labelledOn(db, new Date('2026-11-10T00:00:00Z'))).toBe(1);
    expect(labelledOn(db, new Date('2026-11-10T23:59:59Z'))).toBe(1);
    expect(labelledOn(db, new Date('2026-11-11T00:00:00Z'))).toBe(0);
  });

  test("tokensSince sums the batches' tokens from a time", () => {
    const { db } = labelled();
    saveBatch(db, [], { at: LATER, inputTokens: 50, outputTokens: 7 }, LIST);
    expect(tokensSince(db, FIRST)).toEqual({ input: 1250, output: 307 });
    expect(tokensSince(db, new Date('2026-11-11T00:00:00Z'))).toEqual({ input: 50, output: 7 });
    expect(tokensSince(db, new Date('2026-11-13T00:00:00Z'))).toEqual({ input: 0, output: 0 });
  });
});
