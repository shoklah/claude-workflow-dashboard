import { and, asc, desc, eq, isNull, notInArray, sql } from 'drizzle-orm';
import type { Report, Warning } from '@cwd/shared';
import { runKey, sessionKey } from '../keys.ts';
import { mergeKnown } from './merge.ts';
import type { Db, Tx } from './open.ts';
import { setSeenAt } from './read.ts';
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
 * Stores an export in one transaction. `rawUnits` holds the export's runs and sessions as received, in the report's
 * order, and its totals; the export's category list is stored as the loader read it. A run with no key is skipped.
 * A stored unit absent from the export is marked missing, never deleted. The first successful import sets the "seen"
 * time, so the feed starts empty.
 */
export function importReport(
  db: Db,
  report: Report,
  rawUnits: { runs: unknown[]; sessions: unknown[]; totals: unknown },
  at: Date,
): void {
  db.transaction((tx) => {
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
        .where(and(eq(units.kind, kind), isNull(units.missingSince), notInArray(units.key, keys)))
        .run();
    }
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
