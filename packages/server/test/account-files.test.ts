import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { loadReport } from '@cwd/shared';
import { fixture, reportFixtures } from '../../shared/test/fixture.ts';
import { accountFiles } from '../src/hosted/account-files.ts';
import { importReport } from '../src/db/import.ts';
import { listUnits } from '../src/db/read.ts';

const dirs: string[] = [];
const opened: ReturnType<typeof accountFiles>[] = [];

/** Account files over a fresh temp data folder. */
function fresh() {
  const dir = mkdtempSync(join(tmpdir(), 'cwd accounts '));
  dirs.push(dir);
  const files = accountFiles(dir);
  opened.push(files);
  return { dir, files };
}

afterEach(() => {
  for (const files of opened.splice(0)) files.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test('each account has its own file, opened once', () => {
  const { dir, files } = fresh();
  const one = files.db(1);
  const two = files.db(2);
  expect(one).not.toBe(two);
  expect(files.db(1)).toBe(one);
  expect(existsSync(join(dir, 'accounts', '1.sqlite'))).toBe(true);
  expect(existsSync(join(dir, 'accounts', '2.sqlite'))).toBe(true);
});

test("a unit imported into one account is absent from another's", () => {
  const { files } = fresh();
  const raw = fixture(reportFixtures()[0]);
  const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
  if (!loaded.ok) throw new Error('fixture does not load');
  importReport(files.db(1), loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, new Date());
  expect(listUnits(files.db(1), 'run').length).toBeGreaterThan(0);
  expect(listUnits(files.db(2), 'run')).toEqual([]);
  expect(listUnits(files.db(2), 'session')).toEqual([]);
});

test('an id that is not a positive safe integer throws', () => {
  const { files } = fresh();
  for (const id of [0, -1, 1.5, Number('1/../x'), Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => files.db(id)).toThrow('bad account id');
  }
});
