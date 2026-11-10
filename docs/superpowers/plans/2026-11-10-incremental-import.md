# Incremental Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import with the reporter's `--json --changed-since <cursor>` (CR6), storing its cursor and marking `removed` keys missing.

**Architecture:** `importOnce` sends the stored cursor (or `0`) to the reporter and hands it to `importReport`, which decides from the returned cursor whether the export is incremental (same state id, higher sequence) or full. Incremental: upsert what's carried, mark `removed` missing. Full: today's behaviour, absent units marked missing. The cursor is a stored fact in `state`, written in the import's transaction.

**Tech Stack:** TypeScript on Node (type stripping), zod, Drizzle over better-sqlite3, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-incremental-import-design.md`

## Global Constraints

- The cursor is a stored fact (`state`, name `cursor`); `rebuildDerived` never touches it.
- A unit is never deleted; only `missingSince` marks it.
- Fixtures are invented; incremental exports in tests are built from existing fixtures (a subset of units plus `cursor` and `removed`), never as new fixture files.
- No test runs the real reporter; stand-in commands ignore extra arguments.
- Error text never quotes the reporter's stdout (unchanged rule; no new error text is added).
- Relative imports carry `.ts`; type-only imports use `import type`; erasable-only TypeScript.

## Review Focus

1. The reporter's state was lost or rebuilt: the returned cursor has another state id, so the export is full and every stored unit it lacks is marked missing (Task 1 test).
2. The import fails after the reporter already advanced its state: the stored cursor is unchanged, so the next run sends the old one and gets every change since (Task 2 test).
3. A key in `removed` that is already missing keeps its first `missingSince` (Task 1 test).
4. A unit in `removed` that comes back in a later incremental export has its missing mark cleared (Task 1 test).
5. A plain export with no `cursor` after a stored one: imported as full, the stored cursor kept (Task 1 test).

---

### Task 1: Incremental import in `importReport`, and the stored cursor

**Files:**
- Modify: `packages/shared/src/report.ts` (`ReportSchema`)
- Modify: `packages/server/src/db/read.ts` (cursor getter and setter beside `getSeenAt`/`setSeenAt`)
- Modify: `packages/server/src/db/import.ts` (`isIncremental`, `importReport`)
- Modify: `packages/server/src/db/schema.ts` (the `missingSince` comment at the top: it records the exports or `removed` lists that dropped a unit)
- Modify: `CLAUDE.md` (`## Code conventions`, one line)
- Test: `packages/server/test/import.test.ts`

**Interfaces:**
- Produces: `ReportSchema` gains `cursor: z.string().nullish()` and `removed: z.object({ runs: z.array(z.string()), sessions: z.array(z.string()) }).nullish()`.
- Produces: `getCursor(db: Db): string | null` and `setCursor(db: Db | Tx, cursor: string): void` in `db/read.ts`, state name `'cursor'`.
- Produces: `isIncremental(sent: string | null, got: string | null | undefined): boolean` in `db/import.ts`.
- Produces: `importReport(db, report, rawUnits, at, sent: string | null = null)`: the new last parameter is the cursor sent to the reporter; `check-real.ts`'s call is unchanged.

- [ ] **Step 1: Write the failing tests** in `import.test.ts`

Extend the `importFixture` helper with an optional `sent` and a `change(raw)` callback applied to the fixture's JSON before loading, so a test can set `cursor`, `removed` and a subset of `runs`/`sessions`. Tests (keys from `runKey`/`sessionKey` of the loaded report; `report-full` has 5 runs and 2 sessions):

- `isIncremental`: `(null, 'a:2')` false; `('a:1', 'a:2')` true; `('a:2', 'a:2')` false; `('a:3', 'a:2')` false; `('a:1', 'b:2')` false; `('a:1', null)` false; `('a:1', 'a2')` false; `('a:1', 'a:x')` false; an id holding `:` (`('a:b:1', 'a:b:2')`) true, since the sequence is after the last `:`.
- 'stores the export\'s cursor': full import of `report-full` with `cursor: 's1:1'` → `getCursor(db)` is `'s1:1'`.
- 'an incremental export marks only removed units missing': full import with `cursor 's1:1'` at FIRST; then at LATER, sent `'s1:1'`, the export carries only run 0 (changed: a field edited so it gets a second version), `cursor 's1:2'`, `removed: { runs: [key of run 1], sessions: [key of session 0] }` → run 1 and session 0 have `missingSince` LATER; runs 0, 2, 3, 4 and session 1 have `missingSince` null; run 0 has 2 versions; `getCursor` is `'s1:2'`; `lastGoodImport(db)?.totals` equals the export's totals.
- 'a removed key already missing keeps its first time': as above, then a third incremental at a later time (sent `'s1:2'`, cursor `'s1:3'`) removing run 1 again → its `missingSince` stays LATER.
- 'a removed unit that comes back is present again': after run 1 is removed, an incremental export carrying run 1 (cursor `'s1:3'`) → its `missingSince` is null.
- 'a removed key that was never stored is ignored': `removed.runs: ['0000000000000000']` → no throw, no unit added.
- 'another state id is a full export': stored `'s1:1'`, then sent `'s1:1'`, export holds only run 0 and session 0 with `cursor 's2:1'` and an empty `removed` → runs 1–4 and session 1 are marked missing; `getCursor` is `'s2:1'`.
- 'an export with no cursor is full and keeps the stored cursor': stored `'s1:1'`, then a plain export (no `cursor`) holding only run 0 and session 0, sent `'s1:1'` → the other units are marked missing; `getCursor` is still `'s1:1'`.
- 'rebuildDerived keeps the cursor': after an import with a cursor, `rebuildDerived(db)` → `getCursor` unchanged.

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm exec vitest run packages/server/test/import.test.ts`
Expected: FAIL (`isIncremental`, `getCursor` not exported).

- [ ] **Step 3: Implement**

- `report.ts`: the two nullish fields above.
- `read.ts`: `getCursor`/`setCursor` as `getSeenAt`/`setSeenAt` do, the value stored as given.
- `import.ts`: `isIncremental` splits each cursor at its last `:`; true only when `sent` and `got` are both strings with that `:`, the ids are equal, both sequences match `/^\d+$/` and `got`'s is the larger (compare as numbers). In `importReport`, inside the transaction: `const incremental = isIncremental(sent, report.cursor)`; upsert the carried units as today; then, per kind, if incremental, set `missingSince: at` where kind matches, `missingSince` is null and the key is in `report.removed?.[kind === 'run' ? 'runs' : 'sessions'] ?? []` (skip the update when that list is empty); else today's `notInArray` absence update. After the units, `if (report.cursor) setCursor(tx, report.cursor)`. Update the doc comment: what's incremental, what's full, and that the cursor is stored with the import.
- `schema.ts`: the `missingSince` comment.
- `CLAUDE.md`, under `## Code conventions`: "The reporter's cursor (`state`'s `cursor`, `getCursor`/`setCursor` in `db/read.ts`) is a stored fact, written only by `importReport` in the import's transaction from the export's `cursor`; an export is incremental only when `isIncremental` holds for the cursor sent and the one returned (same state id, higher sequence), and then only its `removed` keys are marked missing; any other export is full, and every stored unit it lacks is marked missing."

- [ ] **Step 4: Run the tests and the type check**

Run: `pnpm exec vitest run packages/server/test/import.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/report.ts packages/server/src/db packages/server/test/import.test.ts CLAUDE.md
git commit -m "feat: import CR6's incremental exports: stored cursor, removed keys marked missing"
```

### Task 2: `importOnce` sends `--changed-since`

**Files:**
- Modify: `packages/server/src/reporter.ts` (`importOnce`)
- Modify: `packages/server/src/dev-fixtures.ts` (both `['cat', file]` commands)
- Modify: `CLAUDE.md` (`## Code conventions`, one line)
- Test: `packages/server/test/reporter.test.ts`

**Interfaces:**
- Consumes: `getCursor(db)`, `importReport(db, report, rawUnits, at, sent)` from Task 1.

- [ ] **Step 1: Write the failing tests** in `reporter.test.ts`, `describe('importOnce')`

Switch the existing `['cat', fixturePath(...)]` commands in `importOnce`'s tests to `['sh', '-c', 'cat "$0"', fixturePath(...)]`, which ignores the appended arguments (`runReporter`'s own tests keep `cat`). New tests, each with a stand-in that records its arguments: `['sh', '-c', 'echo "$2 $3" >> "$1"; cat "$0"', file, argsFile]`, where `file` is a temp copy of `report-full` with a `cursor` set:

- 'sends 0 when no cursor is stored, then the stored cursor': two `importOnce` runs (the file's cursor `'s1:1'`, then rewritten to `'s1:2'` between them) → `argsFile` lines are `--changed-since 0` then `--changed-since s1:1`; `getCursor(db)` is `'s1:2'`.
- 'a failed import keeps the cursor': after a good import storing `'s1:1'`, a run whose stand-in prints a report failing the loader (`report-shape`'s content with `cursor 's1:2'`) → `getCursor(db)` is still `'s1:1'`, and the next run sends `--changed-since s1:1`.

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm exec vitest run packages/server/test/reporter.test.ts`
Expected: FAIL (no arguments recorded; the cursor isn't stored).

- [ ] **Step 3: Implement**

- `importOnce`: read `getCursor(db)` before running, run `[...config.reporterCommand, '--changed-since', sent ?? '0']`, and pass `sent` to `importReport`. Doc comment: the cursor sent and why a failure keeps it.
- `dev-fixtures.ts`: both commands become `['sh', '-c', 'cat "$0"', file]`.
- `CLAUDE.md`, under `## Code conventions`: "`importOnce` appends `--changed-since <getCursor or 0>` to the reporter command, so a command standing in for the reporter (dev:fixtures, tests) ignores extra arguments: `['sh', '-c', 'cat \"$0\"', file]`; check:real runs the plain command, which never touches the reporter's state."

- [ ] **Step 4: Run the server tests, the type check and dev:fixtures' start**

Run: `pnpm exec vitest run packages/server && pnpm typecheck`
Expected: PASS. Then run `pnpm --filter @cwd/server dev:fixtures` in the background, check it logs that it listens (every fixture imported), and stop it.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/reporter.ts packages/server/src/dev-fixtures.ts packages/server/test/reporter.test.ts CLAUDE.md
git commit -m "feat: importOnce sends the stored cursor with --changed-since"
```

### Task 3: check:real compares the reporter's keys with the app's

**Files:**
- Modify: `packages/server/src/check-real.ts` (after the `run keys:` line)
- Modify: `docs/superpowers/specs/2026-11-10-incremental-import-design.md` (design item 7's output wording, to match)
- Test: `packages/server/test/check-real.test.ts`

**Interfaces:**
- Consumes: `runKey`, `sessionKey` from `keys.ts` (unchanged).

**Failing-test check:** the new tests are in `check-real.test.ts`.

- [ ] **Step 1: Write the failing tests** in `check-real.test.ts`

A new line right after `run keys: …`: `reporter keys: N compared, M differ` (counts only, never a key), or `reporter keys: not in the export` when no run or session carries a string `key`. Counted on the raw `runs` and `sessions` like `run keys`: a unit with a string `key` is compared with `runKey`/`sessionKey` of it (a run whose `runKey` is null differs).

- Every existing expected output gains `reporter keys: not in the export\n` after the `run keys` line (`report-full`, `report-v5` have no `key`); `report-v6`'s gains `reporter keys: 12 compared, 0 differ\n` (7 runs and 5 sessions carry a `key`).
- 'counts reporter keys that differ': `report-v6` with one run's `key` and one session's `key` replaced by `'0000000000000000'` → `reporter keys: 12 compared, 2 differ`, and the output doesn't contain `0000000000000000`.

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm exec vitest run packages/server/test/check-real.test.ts`
Expected: FAIL (no `reporter keys` line).

- [ ] **Step 3: Implement** the line in `check-real.ts`, beside the `run keys` count, with a one-line comment on why (`removed` matches stored keys only if the recipes agree). Update design item 7 to say `reporter keys: N compared, M differ` or `not in the export`.

- [ ] **Step 4: Run the tests**

Run: `pnpm exec vitest run packages/server/test/check-real.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/check-real.ts packages/server/test/check-real.test.ts docs/superpowers/specs/2026-11-10-incremental-import-design.md
git commit -m "feat: check:real compares the reporter's unit keys with the app's"
```
