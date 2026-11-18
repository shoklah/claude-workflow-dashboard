import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { openDb, type Db } from '../db/open.ts';
import { rebuildDerived } from '../db/import.ts';

/**
 * Each account's database, `<dataDir>/accounts/<id>.sqlite`, opened, migrated and rebuilt once per process on its first
 * use, then kept open; `remove` closes it and deletes the file with its `-journal`, `-wal` and `-shm`, so no hot journal
 * rolls back into the next file at that path. A path is built only from a positive safe integer id; any other id throws.
 */
export type AccountFiles = { db(id: number): Db; remove(id: number): void; close(): void };

export function accountFiles(dataDir: string): AccountFiles {
  const open = new Map<number, Db>();
  const fileOf = (id: number) => {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('bad account id');
    return join(dataDir, 'accounts', `${id}.sqlite`);
  };
  return {
    db(id) {
      const file = fileOf(id);
      let db = open.get(id);
      if (!db) {
        db = openDb(file);
        rebuildDerived(db);
        open.set(id, db);
      }
      return db;
    },
    remove(id) {
      const file = fileOf(id);
      open.get(id)?.$client.close();
      open.delete(id);
      for (const end of ['', '-journal', '-wal', '-shm']) rmSync(file + end, { force: true });
    },
    close() {
      for (const db of open.values()) db.$client.close();
      open.clear();
    },
  };
}
