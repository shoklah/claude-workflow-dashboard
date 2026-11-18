import { join } from 'node:path';
import { openDb, type Db } from '../db/open.ts';
import { rebuildDerived } from '../db/import.ts';

/**
 * Each account's database, `<dataDir>/accounts/<id>.sqlite`, opened, migrated and rebuilt once per process on its first
 * use, then kept open. A path is built only from a positive safe integer id; any other id throws.
 */
export function accountFiles(dataDir: string): { db(id: number): Db; close(): void } {
  const open = new Map<number, Db>();
  return {
    db(id) {
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error('bad account id');
      let db = open.get(id);
      if (!db) {
        db = openDb(join(dataDir, 'accounts', `${id}.sqlite`));
        rebuildDerived(db);
        open.set(id, db);
      }
      return db;
    },
    close() {
      for (const db of open.values()) db.$client.close();
      open.clear();
    },
  };
}
