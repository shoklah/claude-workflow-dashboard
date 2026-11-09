import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// unitVersions holds every raw JSON a run or session had, in order; units' merged, readable and firstSeenAt, and
// the warnings table, are derived from it and can be rebuilt (rebuildDerived). missingSince is not derived: it
// records which exports a unit was absent from.

const kind = () => text('kind', { enum: ['run', 'session'] }).notNull();
const time = (name: string) => integer(name, { mode: 'timestamp_ms' });

export const units = sqliteTable(
  'units',
  {
    kind: kind(),
    key: text('key').notNull(),
    firstSeenAt: time('first_seen_at').notNull(),
    missingSince: time('missing_since'),
    // A run's latest export had a non-null window; a session is always readable.
    readable: integer('readable', { mode: 'boolean' }).notNull(),
    merged: text('merged', { mode: 'json' }).$type<unknown>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.kind, t.key] })],
);

export const unitVersions = sqliteTable(
  'unit_versions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    kind: kind(),
    key: text('key').notNull(),
    receivedAt: time('received_at').notNull(),
    raw: text('raw', { mode: 'json' }).$type<unknown>().notNull(),
  },
  (t) => [index('unit_versions_unit').on(t.kind, t.key)],
);

export const warnings = sqliteTable(
  'warnings',
  {
    kind: kind(),
    key: text('key').notNull(),
    text: text('text').notNull(),
    firstSeenAt: time('first_seen_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.kind, t.key, t.text] })],
);

export const imports = sqliteTable('imports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  at: time('at').notNull(),
  ok: integer('ok', { mode: 'boolean' }).notNull(),
  error: text('error'),
  // The export's totals as received, kept for slice 2's pages.
  totals: text('totals', { mode: 'json' }).$type<unknown>(),
});

export const state = sqliteTable('state', {
  name: text('name').primaryKey(),
  value: text('value').notNull(),
});
