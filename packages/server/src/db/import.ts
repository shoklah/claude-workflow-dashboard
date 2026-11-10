import { and, asc, desc, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import type { Report, Warning } from '@cwd/shared';
import { runKey, sessionKey } from '../keys.ts';
import { mergeKnown } from './merge.ts';
import type { Db, Tx } from './open.ts';
import { clearCursor, setCursor, setSeenAt } from './read.ts';
import { imports, units, unitVersions, warnings } from './schema.ts';

type Kind = 'run' | 'session';
// The fields of a unit's raw JSON its derived rows read; the loader has already checked their shape.
type RawUnit = { window?: unknown; warns?: string[] | null; warnings?: Warning[] | null };

/**
 * Folds one raw version of a unit into its derived row and its warnings, and returns the new merged facts. `prev` is
 * the unit's merged facts before this version, undefined for its first version, which also sets firstSeenAt. A
 * warning's kind and step come from the version's warning object of the same text; one this version doesn't give
 * keeps its stored value, so the latest known one wins, as mergeKnown keeps a fact. A warning's firstSeenAt never
 * changes.
 */
function applyVersion(tx: Tx, kind: Kind, key: string, raw: unknown, receivedAt: Date, prev: unknown): unknown {
  const { window, warns, warnings: objects } = raw as RawUnit;
  const merged = mergeKnown(prev, raw);
  const readable = kind === 'session' || window != null;
  tx.insert(units)
    .values({ kind, key, firstSeenAt: receivedAt, readable, merged })
    .onConflictDoUpdate({
      target: [units.kind, units.key],
      set: prev === undefined ? { firstSeenAt: receivedAt, readable, merged } : { readable, merged },
    })
    .run();
  for (const text of warns ?? []) {
    const object = objects?.find((w) => w.text === text);
    tx.insert(warnings)
      .values({ kind, key, text, firstSeenAt: receivedAt, warningKind: object?.kind, stepKind: object?.step?.step })
      .onConflictDoUpdate({
        target: [warnings.kind, warnings.key, warnings.text],
        set: {
          warningKind: sql`coalesce(excluded.warning_kind, ${warnings.warningKind})`,
          stepKind: sql`coalesce(excluded.step_kind, ${warnings.stepKind})`,
        },
      })
      .run();
  }
  return merged;
}

/** Stores a unit's raw JSON as a new version when it differs from its latest one, and marks the unit present. */
function importUnit(tx: Tx, kind: Kind, key: string, raw: unknown, at: Date): void {
  const unit = and(eq(units.kind, kind), eq(units.key, key));
  const latest = tx
    .select({ raw: unitVersions.raw })
    .from(unitVersions)
    .where(and(eq(unitVersions.kind, kind), eq(unitVersions.key, key)))
    .orderBy(desc(unitVersions.id))
    .limit(1)
    .get();
  if (!latest || JSON.stringify(latest.raw) !== JSON.stringify(raw)) {
    tx.insert(unitVersions).values({ kind, key, receivedAt: at, raw }).run();
    const prev = tx.select({ merged: units.merged }).from(units).where(unit).get();
    applyVersion(tx, kind, key, raw, at, prev?.merged);
  }
  tx.update(units).set({ missingSince: null }).where(unit).run();
}

/**
 * Whether an export is incremental: `sent` is the cursor sent to the reporter and `got` the export's, each a state id
 * and a sequence split at the last `:`; true only when the ids are equal and `got`'s sequence is the higher.
 */
export function isIncremental(sent: string | null, got: string | null | undefined): boolean {
  const split = (cursor: string | null | undefined) => {
    if (!cursor) return null;
    const at = cursor.lastIndexOf(':');
    const seq = cursor.slice(at + 1);
    return at < 0 || !/^\d+$/.test(seq) ? null : { id: cursor.slice(0, at), seq: Number(seq) };
  };
  const a = split(sent);
  const b = split(got);
  return a !== null && b !== null && a.id === b.id && b.seq > a.seq;
}

/**
 * Stores an export in one transaction. `rawUnits` holds the export's runs and sessions as received, in the report's
 * order, and its totals; the export's category list is stored as the loader read it. A run with no key is skipped.
 * `sent` is the cursor sent to the reporter: an export is incremental when `isIncremental` holds for it and the
 * export's cursor, and then only its `removed` keys are marked missing; any other export is full, and a stored unit
 * absent from it is marked missing. A unit is never deleted. The export's cursor is stored with the import; an export
 * with none clears the stored cursor, so the next import resyncs in full. The first successful import sets the "seen" time, so the feed starts empty.
 */
export function importReport(
  db: Db,
  report: Report,
  rawUnits: { runs: unknown[]; sessions: unknown[]; totals: unknown },
  at: Date,
  sent: string | null = null,
): void {
  db.transaction((tx) => {
    const incremental = isIncremental(sent, report.cursor);
    const first = !tx.select({ id: imports.id }).from(imports).where(eq(imports.ok, true)).limit(1).get();
    const exported = {
      run: report.runs.map((run, i) => ({ key: runKey(run), raw: rawUnits.runs[i] })),
      session: report.sessions.map((s, i) => ({ key: sessionKey(s), raw: rawUnits.sessions[i] })),
    };
    for (const kind of ['run', 'session'] as const) {
      const keys: string[] = [];
      for (const { key, raw } of exported[kind]) {
        if (key === null) continue;
        keys.push(key);
        importUnit(tx, kind, key, raw, at);
      }
      tx.update(units)
        .set({ missingSince: at })
        .where(
          and(
            eq(units.kind, kind),
            isNull(units.missingSince),
            incremental
              ? inArray(units.key, report.removed?.[kind === 'run' ? 'runs' : 'sessions'] ?? [])
              : notInArray(units.key, keys),
          ),
        )
        .run();
    }
    if (report.cursor) setCursor(tx, report.cursor);
    else clearCursor(tx);
    tx.insert(imports).values({ at, ok: true, totals: rawUnits.totals, categories: report.categories ?? null }).run();
    if (first) setSeenAt(tx, at);
  });
}

/** Records a failed import; the stored data stays as it is. */
export function recordImportFailure(db: Db, error: string, at: Date): void {
  db.insert(imports).values({ at, ok: false, error }).run();
}

/** Rebuilds every derived value (merged, readable, firstSeenAt, the warnings) from the stored raw versions. */
export function rebuildDerived(db: Db): void {
  db.transaction((tx) => {
    tx.delete(warnings).run();
    const merged = new Map<string, unknown>();
    for (const v of tx.select().from(unitVersions).orderBy(asc(unitVersions.id)).all()) {
      const unit = `${v.kind} ${v.key}`;
      merged.set(unit, applyVersion(tx, v.kind, v.key, v.raw, v.receivedAt, merged.get(unit)));
    }
  });
}
