import { and, asc, count, eq, gte, lt, sum } from 'drizzle-orm';
import { areaOf, CATEGORY_LIST_VERSION, type Area, type Relevance, type RunEntry } from '@cwd/shared';
import { hash } from '../keys.ts';
import { trimPaths } from '../text.ts';
import type { Db } from './open.ts';
import type { StoredUnit } from './read.ts';
import { findingLabels, labelBatches } from './schema.ts';

/** A finding as the labeller is given it: its trimmed text, and the hash a label of that text is stored under. */
export type LabelInput = { runKey: string; findingId: string; area: Area; text: string; hash: string };

export type StoredLabel = {
  runKey: string;
  findingId: string;
  hash: string;
  model: string;
  category: string;
  relevance: Relevance;
  reason: string;
  labelledAt: Date;
};

const DAY = 24 * 60 * 60 * 1000;

/** The key currentLabels gives a finding's label under. */
export const findingKey = (runKey: string, findingId: string) => `${runKey} ${findingId}`;

/**
 * Every stored run's findings that have an id, from steps that have a kind. The text holds the finding's facts with
 * every string's absolute paths cut, so no path reaches the model, and a changed fact changes the hash.
 */
export function labelInputs(runs: StoredUnit<RunEntry>[]): LabelInput[] {
  const inputs: LabelInput[] = [];
  for (const run of runs) {
    for (const s of run.merged.steps ?? []) {
      if (!s.step) continue;
      for (const f of s.findings ?? []) {
        if (!f.id) continue;
        const { severity, kind, summary, outcome, reason, verdicts } = f;
        const text = JSON.stringify({ step: s.step, severity, kind, summary, outcome, reason, verdicts }, (_key, value) =>
          typeof value === 'string' ? trimPaths(value) : value,
        );
        inputs.push({ runKey: run.key, findingId: f.id, area: areaOf(s.step), text, hash: hash(text) });
      }
    }
  }
  return inputs;
}

/** Each input's label, keyed `${runKey} ${findingId}`: the latest at the current list version for the input's hash. */
export function currentLabels(db: Db, inputs: LabelInput[]): Map<string, StoredLabel> {
  const hashes = new Map(inputs.map((i) => [findingKey(i.runKey, i.findingId), i.hash]));
  const labels = new Map<string, StoredLabel>();
  const rows = db
    .select()
    .from(findingLabels)
    .where(eq(findingLabels.listVersion, CATEGORY_LIST_VERSION))
    .orderBy(asc(findingLabels.labelledAt))
    .all();
  for (const row of rows) {
    const key = findingKey(row.runKey, row.findingId);
    if (hashes.get(key) !== row.inputHash) continue;
    const { inputHash, listVersion, ...label } = row;
    labels.set(key, { ...label, hash: inputHash });
  }
  return labels;
}

/** The inputs with no label from `model` at the current list version for their hash. */
export function pendingInputs(db: Db, inputs: LabelInput[], model: string): LabelInput[] {
  const done = new Set(
    db
      .select()
      .from(findingLabels)
      .where(and(eq(findingLabels.listVersion, CATEGORY_LIST_VERSION), eq(findingLabels.model, model)))
      .all()
      .map((row) => `${findingKey(row.runKey, row.findingId)} ${row.inputHash}`),
  );
  return inputs.filter((i) => !done.has(`${findingKey(i.runKey, i.findingId)} ${i.hash}`));
}

/** Stores a batch's labels, at the current list version, and its token usage, in one transaction. */
export function saveBatch(
  db: Db,
  labels: StoredLabel[],
  usage: { at: Date; inputTokens: number; outputTokens: number },
): void {
  db.transaction((tx) => {
    for (const { hash: inputHash, ...label } of labels) {
      tx.insert(findingLabels).values({ ...label, inputHash, listVersion: CATEGORY_LIST_VERSION }).run();
    }
    tx.insert(labelBatches).values(usage).run();
  });
}

/** The labels stored on the UTC day that holds `day`. */
export function labelledOn(db: Db, day: Date): number {
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const end = new Date(start.getTime() + DAY);
  const row = db
    .select({ n: count() })
    .from(findingLabels)
    .where(and(gte(findingLabels.labelledAt, start), lt(findingLabels.labelledAt, end)))
    .get();
  return row?.n ?? 0;
}

/** The tokens the labeller's batches used from `from` on. */
export function tokensSince(db: Db, from: Date): { input: number; output: number } {
  const row = db
    .select({ input: sum(labelBatches.inputTokens), output: sum(labelBatches.outputTokens) })
    .from(labelBatches)
    .where(gte(labelBatches.at, from))
    .get();
  return { input: Number(row?.input ?? 0), output: Number(row?.output ?? 0) };
}
