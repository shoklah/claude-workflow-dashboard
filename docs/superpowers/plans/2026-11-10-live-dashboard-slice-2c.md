# Live dashboard, slice 2c ("Sessions, skills and commands, the reporter's totals as sums") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- A Sessions page on CR11's session facts.
- Home's skills-and-commands section.
- Session warnings back in showing mode for picked projects.
- 2b's "reporter, all time" figures become period sums over CR6's units, compared by `check:real`.

**Architecture:**
- The loader reads CR6's and CR11's keys: on sessions, `start`, `end`, `project`, `commands`, `advisor`, `notes` and `refusals`; on runs, `typed` and the wider `advisor`; and the top-level `stage_table`. A new invented fixture holds them.
- A session gets a project as runs do, through `projectRoot` and `projectKey`. The scope then shows a picked project's sessions and their warnings.
- The new figures are pure sums in the views that already show them. Each is checked against the reporter's totals.

**Tech Stack:** as slice 2b.

**Spec:** `docs/superpowers/specs/2026-11-09-live-dashboard-design.md`: the "Slice 2 design" section's 2c part and decision 52. **Mockup:** `docs/design/2026-11-10-slice-2c/sessions.html`. **The reporter's keys:** read with `git -C ~/Work/claude-workflow show origin/main:<path>`:
- `docs/superpowers/specs/2026-11-09-incremental-export-design.md`: sections 1 and 5 (CR6's partition and keys)
- `docs/superpowers/specs/2026-11-10-session-facts-design.md`: sections 1, 2, 4 and 6 (CR11's facts and `stage_table`)
- `scripts/workflow-report.py`: `report_data`, `run_entry`, `scoreboard`, `advisor_facts` and `skill_totals`

## Global Constraints

- **As in 2b:**
  - read no real data, and use invented fixtures only
  - every new `report.ts` field is `.nullish()`, and only the fields the dashboard reads
  - a sum over units lives in its view as an exported pure function, and `check:real` compares it
  - a period is `periodQuery` and `period`
  - showing mode applies only in views through `scope.ts`, and every view's tests run `leaks`
  - display text lives in `format.ts`
  - each new page gets a menu entry, a route, `ListFilters`, stories (Empty, Full, Loading and Error), an axe check and a screenshot
- **Sessions:**
  - A session counts in the week of its `start` (`weekOf(parseTime(start))`). A session with no `start` counts in no period.
  - A session's project is `projectRoot(session.project)` when that root is a stored run's root. Otherwise, or with no `project`, it is "other project": it has no key, it counts only in sums, and it is never listed in showing mode.
- **A slash command** is CR11's `{ name, time }`. Its arguments are never exported by the reporter, and the schema reads nothing but `name` and `time`.
- **Showing mode:**
  - A picked project's sessions and their warnings are listed.
  - Every name or title from a unit goes through `maskText`: skill and command names, session titles.
  - A session ID never leaves the backend.
- **Figures that stay the reporter's:** the agents' mismatches, the main sessions' "differs", the advisor's trial and its weekly table, and the stage table, now read from the top-level `stage_table`. Every other figure 2b marked "reporter, all time" becomes a sum.
- **Failing-test check, waves, `E2E_PORT` and the menu baseline:** as in 2b's plan. A wave task runs Playwright on `E2E_PORT` 4400 plus its task number, and leaves `shell.screens.ts` out. The session re-renders the menu baseline after each wave merges.
- **Commit messages** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A session with no `start`, no `project`, or a project that's no stored run's root.** It counts in no period, or shows as "other project". In showing mode it is never listed, and it still counts in sums. Pinned in Tasks 2 and 3.
2. **A transcript holding two runs.** Its session's "Holds" lists both, and its timeline places both windows. Pinned in Task 3.
3. **An export from before CR6 or CR11:** no `start`, `commands`, `advisor.by_role` or `refusals`. Every page renders, and a sum with no unit carrying its key shows "–" (null), never 0. Pinned in Tasks 1 and 4.
4. **A session title naming a hidden project,** or holding a path. It is masked in showing mode, and no response carries a session ID. Pinned in Task 3.
5. **The period sums against the reporter's all-time totals.** Summed over every unit, each new sum equals the reporter's total. A unit with no `advisor` adds nothing, rather than making the total null. Pinned in Tasks 4 and 6.

---

### Task 1: CR6's and CR11's keys, and a fixture that holds them

**Files:**
- Modify: `packages/shared/src/report.ts`
- Create: `packages/shared/fixtures/report-v6.json`
- Modify: `packages/shared/test/load.test.ts`
- Modify: `packages/server/src/dev-fixtures.ts` (default fixtures `report-full report-later report-v6`)
- Modify: `packages/server/src/views/runs.ts` (`periodSessions`)
- Create: `packages/server/test/period-sessions.test.ts`
- Modify: the e2e assertions and screens baselines the new last fixture changes

**Interfaces:**
- `UnitAdvisorSchema = { calls: num, cost: num, tokens: counts, by_role: z.record(z.string(), z.object({ calls: num, flagged: bool })).nullish(), failed: counts, weeks: z.array(z.object({ week: str, advisor: num, fable: num })).nullish() }`. `RunEntrySchema.advisor` becomes it.
- `RunEntrySchema` gains `typed: z.array(z.object({ skill: str, time: str, met: bool })).nullish()`.
- `SessionEntrySchema` gains:
  - `start: str` and `end: str`
  - `project: str`
  - `commands: z.array(z.object({ name: str, time: str })).nullish()`
  - `advisor: UnitAdvisorSchema.nullish()`
  - `notes: z.object({ notes: num, changed: num, missing: num }).nullish()`
  - `refusals: counts`
- `ReportSchema` gains `stage_table: z.record(z.string(), z.record(z.string(), z.string().nullable())).nullish()`.
- `periodSessions(sessions: StoredUnit<SessionEntry>[], weeks: string[]): StoredUnit<SessionEntry>[]` in `views/runs.ts`: the sessions whose `start` week is one of `weeks`. Tasks 3, 4 and 5 date sessions only through it.

**The fixture `report-v6.json`:** report-v5's units, invented, plus CR6's and CR11's keys:
- **Sessions:** every session gets `start`, `end`, `project`, `commands`, `advisor`, `notes` and `refusals`, and every run gets `typed`.
- **A transcript holding two runs:** the lantern-notes Full and plan runs share one `window.transcript`. Its session has rows outside both windows: a `/model` command, a `/grill-me` command whose `typed` entry has `met: false`, and a skill load.
- **A session in a project no run has:** `project: "/Users/example/Scratch/notes"`.
- **A session with `start`, `end` and `project` null.**
- **A session titled after a hidden project** ("Port tidepool-api's retry to lantern-notes").
- **The top-level `stage_table`:** an invented table for `full`, `plan` and `small`.
- **`totals`:** they agree with the units by the reporter's rules, as the fixture convention says. In particular, these sums over every run and session match:
  - `dispatch_guard` sums the units' `refusals`
  - `startup` counts the sessions' `startup`
  - `scoreboard.advisor` and `totals.advisor` sum the units' `advisor` and `notes`
  - each `skills[].missing` adds the runs' `missing_skills` and every unit's unmet `typed`

- [ ] **Step 1: Write the failing tests.**
  - In `load.test.ts`: report-v6 loads, and a session's `start`, `project`, `commands[0].name`, `advisor.by_role`, `refusals` and the top-level `stage_table.full` parse.
  - In `period-sessions.test.ts`: a session counts in its `start`'s week, a session at Sunday 07:00 UTC counts in the week starting then, and a session with no `start` counts in none.
- [ ] **Step 2: Run** `pnpm vitest run packages/shared/test/load.test.ts packages/server/test/period-sessions.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Change dev:fixtures' default list. Update only the e2e assertions the new last fixture changes, then run `pnpm test:screens --update-snapshots` and commit the baselines.
- [ ] **Step 4: Run** `pnpm vitest run`, `pnpm typecheck`, the Playwright checks and `pnpm test:screens`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: the loader reads each session's start, end, project, commands and advisor, runs' typed triggers, and the stage table`.

### Task 2: A session's project, and session warnings in showing mode

**Wave:** A

**Files:**
- Modify: `packages/server/src/views/runs.ts` (`sessionRoot`)
- Modify: `packages/server/src/views/scope.ts` (`showSession`)
- Modify: `packages/server/src/views/home.ts` (the feed's session warnings)
- Modify: `packages/server/src/views/compliance.ts` (its list's session warnings)
- Modify: `packages/server/test/showing.test.ts`, `home.test.ts` and `compliance.test.ts`

**Interfaces:**
- `sessionRoot(session: SessionEntry, roots: Set<string>): string | null` in `views/runs.ts` gives `projectRoot(session.project)` when it is in `roots` (the stored runs' roots), else null.
- `showSession(scope: Scope | null, root: string | null): boolean` in `scope.ts` is true with no scope, and with a scope, true only when the root's key is shown.
- **The feed and Compliance's list:** a session warning stays with a scope when `showSession` is true. Its text goes through `showWarning`, so its `sessionId` is null and the text is masked. The scope's `hidden` counts the ones left out.
- **Unchanged:** the counts (Home's step boxes and tiles, Compliance's cells), which already count every session.

- [ ] **Step 1: Write the failing tests,** on report-v6 with showing set to lantern-notes:
  - **Compliance:** the list holds the lantern-notes session's warning, masked, with `sessionId` null. It doesn't hold the Scratch session's warning, and `hidden` counts that one.
  - **Home:** the feed holds the lantern-notes session warning.
  - **`leaks`:** the check finds nothing on `/api/home` or `/api/compliance?resolved=1&weeks=52`.
  - **`sessionRoot`:** it gives the Scratch session and the null-project session null.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/showing.test.ts packages/server/test/home.test.ts packages/server/test/compliance.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run packages/server` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: a session's project from its working directory; picked projects' session warnings show in showing mode`.

Conventions lines for the report:
- The showing line changes: a session is listed with a scope only when `showSession` holds for `sessionRoot`.
- Compliance's line no longer leaves out every session warning.

### Task 3: The Sessions page

**Files:**
- Create: `packages/shared/src/api/sessions.ts`
- Modify: `packages/shared/src/index.ts` (one line)
- Create: `packages/server/src/views/sessions.ts`
- Modify: `packages/server/src/routes.ts` (a sessions block)
- Create: `packages/server/test/sessions.test.ts`
- Create: `packages/web/src/sessions/SessionsPage.tsx` and `SessionsTable.tsx`, with their stories
- Create: `packages/web/src/test/sessions.ts`
- Modify: `router.tsx` (`/sessions`)
- Modify: `Menu.tsx` (Sessions, after Findings)
- Modify: `format.ts` (`sessionName`)
- Create: `e2e/sessions.spec.ts`
- Create: `e2e/sessions.screens.ts` with its baseline

**Interfaces:**
- `SessionRow = { key: string; title: string | null; sessionId: string | null; projectKey: string | null; project: string | null; start: string | null; end: string | null; minutes: number | null; skills: string[]; commands: { name: string; neverLoaded: boolean }[]; models: { model: string; effort: string | null }[]; cost: number | null; startup: boolean | null; warnings: number; holds: { runKey: string; project: string; branch: string | null; path: Path | null }[]; timeline: { at: string; kind: 'skill' | 'command' | 'run'; name: string; outcome: string | null; neverLoaded: boolean; runKey: string | null }[] }`.
- `SessionsResponse = { sessions: SessionRow[]; hidden: number }`, newest start first, with no-start sessions last.
- `sessionsView({ runs, sessions, warnings, query, now, scope })`:
  - **Period and filters:** the period keeps sessions whose `start` week is in it. The project filter is a key. The path filter keeps sessions holding a run of that path. "Has warnings" keeps sessions with a current warning.
  - **`sessionId`:** the file's UUID with no scope, null with one.
  - **`minutes`:** `end` minus `start`.
  - **`commands`:** marks `neverLoaded` when an unmet `typed` entry has the same skill name.
  - **`models`:** each of its `models`' keys, by cost, with its most-used effort from `efforts`.
  - **`holds`:** the runs whose `window.transcript` is its `file`, with names from `storedFacts`.
  - **`timeline`:** skill loads (outcome through `skillOutcomeLabel`), commands, and each held run's window start, in time order.
  - **With a scope:** only `showSession` sessions are listed. Titles and names go through `maskText`, and `hidden` counts the sessions left out.
- `sessionName(row)` in `format.ts` gives the title, else the ID's first eight characters, else "session".
- **The page:**
  - `ListFilters`, plus "has warnings".
  - `SessionsTable` with an expandable row, as in the mockup.
  - `SessionChip` under the name when `sessionId` is set.
  - "Holds" links to `/runs/$key`.
- **Route:** `GET /api/sessions`, through `periodQuery`, plus `warnings=1`.

- [ ] **Step 1: Write the failing tests.**
  - **In `sessions.test.ts`, on report-v6:**
    - The two-run session holds both runs.
    - Its `/grill-me` is `neverLoaded`.
    - Its timeline orders skill, commands and both window starts.
    - The no-start session is listed last and only in the 52-week period.
  - **With showing on lantern-notes:**
    - The Scratch session isn't listed, and `hidden` counts it.
    - The hidden-project title is masked.
    - No `sessionId` is set.
    - `leaks` finds nothing.
  - **Stories:** Empty, Full (an interaction expands a row), Loading and Error.
  - **The e2e:** open Sessions from the menu, expand the two-run session, follow its run link. axe finds no violations.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/sessions.test.ts packages/web/src/sessions`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run`, `pnpm typecheck`, the Playwright checks and `pnpm test:screens` (menu and sessions baselines). Expected: PASS.
- [ ] **Step 5: Commit:** `feat: the Sessions page: each session's facts, commands, held runs and timeline`.

### Task 4: The reporter's totals become period sums

**Wave:** A

**Files:**
- Modify: `packages/server/src/views/steps.ts`
- Modify: `packages/server/src/views/skills.ts`
- Modify: `packages/server/src/views/models.ts`
- Modify: `packages/shared/src/api/steps.ts`, `api/skills.ts` and `api/models.ts`
- Modify: `routes.ts` (the steps, skills and models blocks pass sessions)
- Modify: `packages/server/test/steps.test.ts`, `skills.test.ts` and `models.test.ts`
- Modify: `packages/web/src/steps/StepsPage.tsx`, `skills/SkillsPage.tsx` and `models/ModelsPage.tsx`, with their stories
- Modify: `packages/web/src/test/steps.ts`, `test/skills.ts` and `test/models.ts`

**Interfaces:**
- `unitSums(runs: RunEntry[], sessions: SessionEntry[]): UnitSums` in `steps.ts`, where `UnitSums = { dispatchGuard: Record<string, number> | null; startup: { with: number; without: number } | null; advisor: { calls; cost; tokens; byRole; failed; notes; changed; missing; share } | null }`, by the reporter's rules (CR6 section 1):
  - `dispatchGuard` sums `refusals`.
  - `startup` counts the sessions' `startup`.
  - `advisor` sums the units' `advisor` and `notes`. Its `share` is `100 × cost / (cost + Fable dollars)`, the Fable dollars being the sum of the units' `advisor.weeks[].fable`, as `share_pct`. It is 0 when both are 0.
  - Each is null when no unit carries its key.
- **The period's units:** runs by finish, sessions by `start` week.
- **`StepsResponse`:** `rules` gains `dispatchGuard`, `startup` and `advisor`. The `reporter` group goes.
- **`ModelsResponse.advisor`:** its `facts` come from `unitSums`, except `trial`, which stays the reporter's. Its `weeks` stay the reporter's rows. `stageSource` reads the top-level `stage_table`.
- **`skillSums`** gains `missing`: the runs' `missing_skills`, plus every period unit's `typed` with `met: false`, by skill. `SkillsResponse.missingSource` goes.
- **The pages:** these figures lose their `ReporterMark`, and the trial, the weekly table, mismatches, "differs" and the stage table keep it.

- [ ] **Step 1: Write the failing tests.**
  - **Over every unit of report-v6:**
    - `unitSums` equals `totals.scoreboard.dispatch_guard`, `.startup` and `.advisor`, and `totals.advisor`'s calls, tokens, cost, by_role, failed and notes, cost to the cent.
    - `skillSums`' `missing` equals `totals.skills[name].missing`.
  - **A narrower period:** it drops a unit outside it.
  - **On report-full** (no CR6 keys): the three figures are null.
  - **Stories:** the pages without the dropped marks.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/steps.test.ts packages/server/test/skills.test.ts packages/server/test/models.test.ts packages/web/src/steps packages/web/src/skills packages/web/src/models`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full checks, as in Task 3. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: dispatch-guard refusals, startup, the advisor's facts and skills' missing become period sums over runs and sessions`.

Conventions line for the report: the reporter-sourced line now lists only mismatches, "differs", the trial, the advisor's weekly table and the stage table (`stage_table`), and the units' advisor, refusals and startup are summed only by `unitSums`.

### Task 5: Home's skills and commands

**Wave:** A

**Files:**
- Create: `packages/shared/src/api/usage.ts`
- Modify: `index.ts` (one line)
- Create: `packages/server/src/views/usage.ts`
- Modify: `routes.ts` (a usage block)
- Create: `packages/server/test/usage.test.ts`
- Create: `packages/web/src/home/SkillsAndCommands.tsx` with its stories
- Modify: `packages/web/src/home/HomePage.tsx` and its stories
- Modify: `packages/web/src/test/home.ts`
- Modify: the home screens baseline

**Interfaces:**
- `UsageRow = { name: string; kind: 'skill' | 'command'; sessions: number; runs: number | null; typed: number; typedNeverLoaded: number | null }`.
- `UsageResponse = { sessions: number; runs: number; rows: UsageRow[] }`, with the rows by `sessions` descending.
- `usageView({ runs, sessions, weeks, now, scope })` over the last `weeks` weeks:
  - **The units:** sessions by `start` week, runs by finish.
  - **A skill row:** `sessions` counts the sessions that loaded the skill or typed a command of its name, `runs` the runs that loaded it, `typed` the commands of its name, and `typedNeverLoaded` the unmet `typed`.
  - **A command row:** a command no skill has. `runs` and `typedNeverLoaded` are null.
  - **With a scope:** names go through `maskText`, and the sums still count everything.
- **Route:** `GET /api/usage?weeks=1|4`.
- **`SkillsAndCommands`:** a "Last 7 days / Last 4 weeks" switch (the `Option` convention), a share-of-sessions bar in one hue with its number written beside it, and the mockup's columns.

- [ ] **Step 1: Write the failing tests.**
  - **In `usage.test.ts`, on report-v6:**
    - The `grill-me` row has `typedNeverLoaded` 1.
    - The `model` row is a command, with `runs` null.
    - `sessions` counts the two-run session once.
    - `leaks` finds nothing with showing on.
  - **Stories:** Empty and Full for the section, plus the HomePage story with the section.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/usage.test.ts packages/web/src/home`. Expected: FAIL.
- [ ] **Step 3: Implement,** with the `dataviz` skill loaded for the bar.
- [ ] **Step 4: Run** the full checks. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: Home's skills and commands across the period's sessions and runs`.

### Task 6: check:real compares the new sums and checks the new routes for leaks

**Files:**
- Modify: `packages/server/src/check-real.ts`
- Modify: `packages/server/test/check-real.test.ts`
- Modify: `README.md`

**Interfaces:** it consumes `unitSums` and `skillSums`' `missing`.

`check:real` gains `units: <n> differ`, comparing `dispatch_guard`, `startup` and the advisor's summed facts with the totals, and its `skills:` line also compares `missing`. Like the existing lines, these print only keys that no project can name. The showing check adds `/api/sessions?weeks=52` and `/api/usage?weeks=4`.

- [ ] **Step 1: Write the failing test.** On report-v6, check:real prints `units: 0 differ` and `showing: pass`, and no line contains `/Users/`.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/check-real.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: check:real compares the units' sums with the reporter and checks the sessions and usage routes for leaks`.
