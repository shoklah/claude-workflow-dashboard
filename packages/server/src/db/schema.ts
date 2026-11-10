import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { RELEVANCE, type CategoryList } from '@cwd/shared';

// unitVersions holds every raw JSON a run or session had, in order; units' merged, readable and firstSeenAt, and
// the warnings table, are derived from it and can be rebuilt (rebuildDerived). missingSince is not derived: it
// records the full exports a unit was absent from, or the incremental exports whose `removed` list named it.

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
    // The latest known kind and step of the warning's object (CR4), null for a warning no export gave one.
    warningKind: text('warning_kind'),
    stepKind: text('step_kind'),
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
  // The export's finding category list as the loader read it, null when it had none; the last good import's is the
  // active list (activeList).
  categories: text('categories', { mode: 'json' }).$type<CategoryList | null>(),
});

export const state = sqliteTable('state', {
  name: text('name').primaryKey(),
  value: text('value').notNull(),
});

// The app's finding labels and the labeller's batches are stored facts: nothing in unitVersions rebuilds them. A
// label is keyed by its finding, the hash of the text it was given, the category list's version and the model.
export const findingLabels = sqliteTable(
  'finding_labels',
  {
    runKey: text('run_key').notNull(),
    findingId: text('finding_id').notNull(),
    inputHash: text('input_hash').notNull(),
    listVersion: integer('list_version').notNull(),
    model: text('model').notNull(),
    category: text('category').notNull(),
    relevance: text('relevance', { enum: RELEVANCE }).notNull(),
    reason: text('reason').notNull(),
    labelledAt: time('labelled_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.runKey, t.findingId, t.inputHash, t.listVersion, t.model] })],
);

export const labelBatches = sqliteTable('label_batches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  at: time('at').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
});
