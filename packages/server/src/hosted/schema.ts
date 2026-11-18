import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
});

export const collectorTokens = sqliteTable('collector_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  hash: text('hash').notNull().unique(),
  accountId: accountId(),
  createdAt: time('created_at').notNull(),
  lastUsedAt: time('last_used_at'),
});
