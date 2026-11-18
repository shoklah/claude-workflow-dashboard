import { activeList } from '../categories.ts';
import type { Db } from '../db/open.ts';
import { labelPending, type LabelClient } from '../labeller.ts';
import { labellerAccounts, type AccountsDb } from './accounts.ts';
import { openKey } from './secret.ts';

/**
 * Hosted mode's label job: each account with a key labels its own file under its active list (none, nothing), with its
 * own client, model and daily max. A key that doesn't open is skipped with a fixed line naming the account, never the
 * key, and the other accounts still go.
 */
export async function labelAccounts(opts: {
  accounts: AccountsDb;
  files: { db(id: number): Db };
  secret: Buffer;
  clientFor: (model: string, key: string) => LabelClient;
  now: () => Date;
}): Promise<void> {
  const { accounts, files, secret, clientFor, now } = opts;
  for (const { accountId, sealedKey, model, dailyMax } of labellerAccounts(accounts)) {
    let key: string;
    try {
      key = openKey(secret, sealedKey);
    } catch {
      console.error(`label: account ${accountId} key does not open`);
      continue;
    }
    const db = files.db(accountId);
    const list = activeList(db);
    if (list) await labelPending(db, clientFor(model, key), { model, dailyMax }, now(), list);
  }
}
