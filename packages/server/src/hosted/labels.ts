import type { Db } from '../db/open.ts';
import { labelOnce, type LabelClient } from '../labeller.ts';
import { getAccount, labellerAccounts, type AccountsDb } from './accounts.ts';
import { openKey } from './secret.ts';

/**
 * Hosted mode's label job: each account with a key labels its own file under its active list (none, nothing), with its
 * own client, model and daily max. A key that doesn't open, or an account whose labelling fails, is skipped with a
 * fixed line naming the account's id, never the key or the error's text, and the other accounts still go. An account
 * deleted since the snapshot is skipped, so `files.db` never recreates its file.
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
      key = openKey(secret, sealedKey, accountId);
    } catch {
      console.error(`label: account ${accountId} key does not open`);
      continue;
    }
    if (!getAccount(accounts, accountId)) continue;
    try {
      await labelOnce(files.db(accountId), clientFor(model, key), { model, dailyMax }, now());
    } catch {
      console.error(`label: account ${accountId} failed`);
    }
  }
}
