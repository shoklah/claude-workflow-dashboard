import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { LABELLER_DEFAULTS } from '@cwd/shared';

// The hosted accounts database. Sessions and collector tokens are stored only as their SHA-256 (hashSecret).

const time = (name: string) => integer(name, { mode: 'timestamp_ms' });
const accountId = () =>
  integer('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' });

/** A GitHub login allowed to create an account, stored lower-case. */
export const invites = sqliteTable('invites', {
  login: text('login').primaryKey(),
  addedAt: time('added_at').notNull(),
});

/** An account, its id GitHub's numeric user id. */
export const accounts = sqliteTable('accounts', {
  id: integer('id').primaryKey(),
  login: text('login').notNull(),
  createdAt: time('created_at').notNull(),
  lastCollectAt: time('last_collect_at'),
});

export const sessions = sqliteTable('sessions', {
  idHash: text('id_hash').primaryKey(),
  accountId: accountId(),
  expiresAt: time('expires_at').notNull(),
  // The owner's account this session views, null for its own; read only while the grant holds (sessionAccount).
  viewingId: integer('viewing_id'),
});

export const collectorTokens = sqliteTable('collector_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  hash: text('hash').notNull().unique(),
  accountId: accountId(),
  createdAt: time('created_at').notNull(),
  lastUsedAt: time('last_used_at'),
});

/**
 * An owner's grant to a GitHub login (lower-case) to view its account read-only. Bound to the viewer's account id
 * when made (if that login has an account) or at that login's first sign-in, and once bound matched by id only.
 */
export const viewerGrants = sqliteTable(
  'viewer_grants',
  {
    ownerId: integer('owner_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    viewerLogin: text('viewer_login').notNull(),
    viewerId: integer('viewer_id').references(() => accounts.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.ownerId, table.viewerLogin] })],
);

/** An account's labeller: its Anthropic key sealed under EDWARD_SECRET (hosted/secret.ts), null for none, never in
 * clear; its model and daily max. */
export const labellerSettings = sqliteTable('labeller_settings', {
  accountId: integer('account_id')
    .primaryKey()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  sealedKey: text('sealed_key'),
  model: text('model').notNull().default(LABELLER_DEFAULTS.model),
  dailyMax: integer('daily_max').notNull().default(LABELLER_DEFAULTS.dailyMax),
});
