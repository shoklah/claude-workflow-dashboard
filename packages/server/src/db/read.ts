import { asc, desc, eq } from 'drizzle-orm';
import { RunEntrySchema, SessionEntrySchema, type RunEntry, type SessionEntry } from '@cwd/shared';
import type { Db, Tx } from './open.ts';
import { imports, state, units, warnings } from './schema.ts';

export type StoredUnit<T> = { key: string; merged: T; firstSeenAt: Date; missingSince: Date | null; readable: boolean };
export type StoredWarning = { kind: 'run' | 'session'; key: string; text: string; firstSeenAt: Date };

const SEEN_AT = 'seenAt';

/** Every stored run or session, its merged facts parsed with the loader's schema. */
export function listUnits(db: Db, kind: 'run'): StoredUnit<RunEntry>[];
export function listUnits(db: Db, kind: 'session'): StoredUnit<SessionEntry>[];
export function listUnits(db: Db, kind: 'run' | 'session'): StoredUnit<RunEntry | SessionEntry>[] {
  const schema = kind === 'run' ? RunEntrySchema : SessionEntrySchema;
  return db
    .select()
    .from(units)
    .where(eq(units.kind, kind))
    .orderBy(asc(units.key))
    .all()
    .map((row) => ({
      key: row.key,
      merged: schema.parse(row.merged),
      firstSeenAt: row.firstSeenAt,
      missingSince: row.missingSince,
      readable: row.readable,
    }));
}

export function listWarnings(db: Db): StoredWarning[] {
  return db
    .select()
    .from(warnings)
    .orderBy(asc(warnings.firstSeenAt), asc(warnings.kind), asc(warnings.key), asc(warnings.text))
    .all();
}

/** The "mark all seen" time: the feed shows what came after it. */
export function getSeenAt(db: Db): Date | null {
  const row = db.select().from(state).where(eq(state.name, SEEN_AT)).get();
  return row ? new Date(row.value) : null;
}

export function setSeenAt(db: Db | Tx, at: Date): void {
  db.insert(state)
    .values({ name: SEEN_AT, value: at.toISOString() })
    .onConflictDoUpdate({ target: state.name, set: { value: at.toISOString() } })
    .run();
}

export function lastImport(db: Db): { at: Date; ok: boolean; error: string | null } | null {
  const row = db.select().from(imports).orderBy(desc(imports.id)).limit(1).get();
  return row ? { at: row.at, ok: row.ok, error: row.error } : null;
}

/** The last successful import, with the export's totals as received. */
export function lastGoodImport(db: Db): { at: Date; totals: unknown } | null {
  const row = db.select().from(imports).where(eq(imports.ok, true)).orderBy(desc(imports.id)).limit(1).get();
  return row ? { at: row.at, totals: row.totals } : null;
}
