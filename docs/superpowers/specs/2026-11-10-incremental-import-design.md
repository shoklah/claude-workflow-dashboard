# Incremental import: design

Date: 2026-11-10. Status: approved by the owner on 2026-11-10 (grill-me offered and skipped). Path: Full (storing and importing data is a risk area). Builds on the live dashboard design (`2026-11-09-live-dashboard-design.md`, decisions 17, 19 and 23, "Loading is upsert by key") and on the reporter's CR6 (`claude-workflow`'s `2026-11-09-incremental-export-design.md`, sections 3 and 5), which is merged and installed.

## Intent

Every import trigger runs a full `--json` today, so the export's cost and size grow with history. CR6 lets the reporter export only what changed since a cursor. The dashboard adopts it, as decision 19 names, with no visible change: the pages read the same stored units.

## Goals

- Import with `--json --changed-since <cursor>`, storing the reporter's new cursor.
- Upsert the units an export carries by key, as today.
- Mark the keys in `removed` missing, never deleted.
- Keep storing every export's `totals` (CR6's are full totals), so `check:real` keeps comparing sums.

## Non-goals

- Any page or API change.
- Any change to the reporter or the workflow repo.
- Making `check:real` incremental: it keeps running plain `--json` into a temp database, which never touches the reporter's state.

## Anti-goals

- A unit marked missing only because an incremental export didn't carry it.
- A unit that vanished while the reporter's state was lost, never marked missing.
- A cursor that moves past changes the dashboard never stored.

## Constraints

- The cursor is a stored fact (`CLAUDE.md`: `state` holds stored facts, not derived ones); `rebuildDerived` doesn't touch it.
- The reporter stays the only parser; the dashboard stores the cursor and passes it back as given.
- Fixtures are invented; no test runs the real reporter.

## Approaches

- **Trust `removed` only, never absence (the starting sketch).** Simple, but when the reporter's state is lost or rebuilt it treats the dashboard's cursor as 0 and returns a full export with an empty `removed`; units gone meanwhile would never be marked.
- **Tell full from incremental by the returned cursor. Picked.** The export is incremental only when the dashboard sent a cursor and the returned cursor has the same state id and a higher sequence; anything else is a full export, imported as today with absence marking. It covers the lost state, a rebuilt state and a first import with one comparison.
- **A full export at every server start as well.** Not needed: the reporter re-exports a unit that comes back (its `changed` resets when `seen` skips a sequence), and the cursor check already recovers from a lost state.

## Design

1. **The cursor** is stored in `state` under `cursor`, written by `importReport` inside the import's transaction. A failed import (reporter failure, loader failure, a throw) leaves the old cursor, so the next export re-sends every change since it.
2. **The command.** `importOnce` runs `config.reporterCommand` plus `--changed-since <stored cursor, or 0>`. Commands that stand in for the reporter (`dev:fixtures`, tests) ignore extra arguments.
3. **The loader.** `ReportSchema` gains `cursor` (string) and `removed` (`{ runs: string[]; sessions: string[] }`), both nullish.
4. **Incremental or full.** Incremental when a cursor was sent and the export's `cursor` has the same state id (the part before the last `:`) and a higher sequence than the one sent. Then:
   - each unit carried is upserted as today (a new version only when its raw JSON differs), and its missing mark is cleared;
   - each key in `removed.runs` and `removed.sessions` that is stored and not already missing is marked missing with the import's time; an unknown key is ignored;
   - a stored unit the export doesn't carry is left as it is.
   Any other export (no cursor sent, another id, a sequence not higher, no `cursor` in the export) is full: imported as today, a stored unit absent from it marked missing.
5. **No `cursor` in the export** (a plain `--json`, a fixture): imported as full, and the stored cursor, if any, is cleared, so the next import sends `0` and resyncs in full. (Changed after the final review: keeping the stored cursor left the marks and versions such an export wrote uncorrected by later incremental exports.)
6. **Totals and categories** are stored with each import, as today.
7. **`check:real`'s key check.** It compares each run's and session's reporter `key` with `runKey` and `sessionKey` and prints `reporter keys: N compared, M differ` or, when no unit carries a `key`, `reporter keys: not in the export`, a count only *(wording changed while planning, from `keys: pass`, to match check:real's other lines; the owner confirms it with the plan)*; a unit without a `key` (an export before CR6) isn't counted. If the recipes drifted, `removed` would match nothing.
8. **`CLAUDE.md`:** one `## Code conventions` line on the cursor and on when a unit is marked missing; the schema's comment on `missingSince` updated.

## Left to the builder

- How the import receives the cursor sent (an argument to `importReport` is the simplest).
- The stand-in command shape for `dev:fixtures` and the tests.
- Test fixtures for incremental exports: built in the tests from existing fixtures (a subset of units plus `cursor` and `removed`), since a fixture's `totals` must agree with its units.

## Claude's calls, open to correction

- The full-or-incremental test by the returned cursor, with absence marking on full exports (covers a lost or rebuilt reporter state).
- No full export at server start.
- The key check in `check:real` (approved with the design).
