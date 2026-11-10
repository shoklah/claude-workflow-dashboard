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

/** A database with report-projects imported and the finding SUMMARY labelled, with the label and its input. */
function labelled(): { db: Db; input: LabelInput; label: StoredLabel } {
  const db = freshDb();
  importRaw(db, fixture('report-projects'), FIRST);
  const input = inputs(db).find((i) => i.text.includes(SUMMARY))!;
  const label = labelFor(input);
  saveBatch(db, [label], { at: LABELLED, inputTokens: 1200, outputTokens: 300 });
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

describe('stored labels', () => {
  test('a saved label is current, and pending only for another model', () => {
    const { db, input, label } = labelled();
    const all = inputs(db);
    expect(currentLabels(db, all).get(keyOf(input))).toEqual(label);
    expect(currentLabels(db, all).size).toBe(1);
    expect(pendingInputs(db, all, MODEL).map(keyOf)).not.toContain(keyOf(input));
    expect(pendingInputs(db, all, MODEL)).toHaveLength(all.length - 1);
    expect(pendingInputs(db, all, 'claude-other-model').map(keyOf)).toContain(keyOf(input));
  });

  test('a changed summary drops the label and makes the finding pending again', () => {
    const { db, input } = labelled();
    const raw = fixture('report-projects');
    for (const run of raw.runs) {
      for (const step of run.steps ?? []) {
        for (const f of step.findings ?? []) if (f.summary === SUMMARY) f.summary = `${SUMMARY}, still`;
      }
    }
    importRaw(db, raw, LATER);
    const all = inputs(db);
    expect(currentLabels(db, all).has(keyOf(input))).toBe(false);
    expect(pendingInputs(db, all, MODEL).map(keyOf)).toContain(keyOf(input));
  });

  test('labelledOn counts a label on its UTC day and not the next', () => {
    const { db } = labelled();
    expect(labelledOn(db, new Date('2026-11-10T00:00:00Z'))).toBe(1);
    expect(labelledOn(db, new Date('2026-11-10T23:59:59Z'))).toBe(1);
    expect(labelledOn(db, new Date('2026-11-11T00:00:00Z'))).toBe(0);
  });

  test("tokensSince sums the batches' tokens from a time", () => {
    const { db } = labelled();
    saveBatch(db, [], { at: LATER, inputTokens: 50, outputTokens: 7 });
    expect(tokensSince(db, FIRST)).toEqual({ input: 1250, output: 307 });
    expect(tokensSince(db, new Date('2026-11-11T00:00:00Z'))).toEqual({ input: 50, output: 7 });
    expect(tokensSince(db, new Date('2026-11-13T00:00:00Z'))).toEqual({ input: 0, output: 0 });
  });
});
