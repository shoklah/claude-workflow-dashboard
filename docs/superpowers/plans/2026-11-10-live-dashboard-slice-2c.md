# Live dashboard, slice 2c ("Sessions, skills and commands, the reporter's totals as sums") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- A Sessions page on CR11's session facts.
- Home's skills-and-commands section.
- Session warnings come back in showing mode for picked projects.
- 2b's "reporter, all time" figures become period sums over CR6's units, compared by `check:real`.

**Architecture:**
- **The loader** reads CR6's and CR11's keys, which a new invented fixture holds:
  - on sessions: `start`, `end`, `project`, `commands`, `advisor`, `notes`, `refusals`
  - on runs: `typed` and the wider `advisor`
- **A session gets a project** through `projectRoot`, as a run does. The scope shows picked projects' sessions and their warnings.
- **The new figures** are pure sums in the views that already show them, each checked against the reporter's totals.
- **Home's section** is part of Home's response.

**Tech Stack:** as slice 2b.

**Spec:** `docs/superpowers/specs/2026-11-09-live-dashboard-design.md`, the "Slice 2 design" section's 2c part and decision 52.

**Mockup:** `docs/design/2026-11-10-slice-2c/sessions.html`.

**The reporter's keys:** read these with `git -C ~/Work/claude-workflow show origin/main:<path>`:
- `docs/superpowers/specs/2026-11-09-incremental-export-design.md`, sections 1 and 5
- `docs/superpowers/specs/2026-11-10-session-facts-design.md`, sections 1, 2 and 6
- `scripts/workflow-report.py`: `report_data`, `run_entry`, `scoreboard`, `advisor_facts`, `skill_totals`

## Global Constraints

- **As in 2b:**
  - read no real data, and use invented fixtures only
  - every new `report.ts` field is `.nullish()`, and only the fields the dashboard reads
  - a sum over units lives in its view as an exported pure function, and `check:real` compares it
  - a period is `periodQuery` and `period`
  - showing mode applies only in views, through `scope.ts`, and every view's tests run `leaks`
  - display text lives in `format.ts`
  - a new page gets a menu entry, a route, `ListFilters`, stories (Empty, Full, Loading and Error), an axe check and a screenshot
- **Sessions:**
  - A session counts in the week of its `start`, and only through `periodSessions` (Task 1). One with no `start` counts in no period.
  - A session's project is `projectRoot(session.project)`. It is named through `storedNames(runs)`, the run projects' names. A root that map doesn't hold, or no `project` at all, is "other project": no key, counted only in sums, never listed in showing mode.
- **A slash command** is CR11's `{ name, time }`, and the schema reads nothing else from it.
- **Showing mode:**
  - It lists a session when `showSession` holds.
  - Every name or title from a unit (skill and command names, session titles) goes through `maskText`.
  - A session ID never leaves the backend.
- **Figures that stay the reporter's:**
  - the agents' mismatches
  - the main sessions' "differs" and their stage table, still read from `totals.models.main[path].recommended`, which CR11 keeps equal to the new `stage_table`
  - the advisor's trial and its weekly table

  Every other figure 2b marked "reporter, all time" becomes a sum.
- **Failing-test check, waves, `E2E_PORT` and the menu baseline:** as in 2b's plan.
  - A wave task runs Playwright on `E2E_PORT` 4400 plus its task number, and leaves `shell.screens.ts` out.
  - The session re-renders the menu baseline after each wave merges.
- **Commit messages** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A session with no `start`, no `project`, or a project that's no stored run's root.** It counts in no period, or shows as "other project". In showing mode it is never listed, though it still counts in sums. Pinned in Tasks 2 and 5.
2. **A transcript holding two runs.** Its session's "Holds" lists both runs, and its timeline places both windows. Pinned in Task 5.
3. **An export from before CR6 or CR11:** no `start`, `commands`, `advisor.by_role` or `refusals`. Every page renders, and a sum with no unit carrying its key shows "–" (null), never 0. Pinned in Tasks 1 and 3.
4. **A session title that names a hidden project, or holds a path.** It is masked in showing mode, and no response carries a session ID. Pinned in Task 5.
5. **The period sums against the reporter's all-time totals.** Summed over every unit, each equals the reporter's total, and a unit with no `advisor` adds nothing. Pinned in Tasks 3 and 6.

---

### Task 1: CR6's and CR11's keys, a fixture that holds them, and dating sessions

**Files:**
- Modify: `packages/shared/src/report.ts`
- Create: `packages/shared/fixtures/report-v6.json`
- Modify: `packages/shared/test/load.test.ts`
- Modify: `packages/server/src/views/runs.ts` (`periodSessions`)
- Create: `packages/server/test/period-sessions.test.ts`
- Modify: `packages/server/src/dev-fixtures.ts` (default fixtures `report-full report-later report-v6`)
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
- `periodSessions(sessions: StoredUnit<SessionEntry>[], weeks: string[]): StoredUnit<SessionEntry>[]`, in `views/runs.ts`: the sessions whose `start` week (`weekOf(parseTime(start))`) is one of `weeks`.

**The fixture `report-v6.json`** is report-v5's units, invented, plus CR6's and CR11's keys:
- **On every unit:** each session gets `start`, `end`, `project`, `commands`, `advisor`, `notes` and `refusals`. Each run gets `typed`.
- **A transcript holding two runs:** the lantern-notes Full and plan runs share one `window.transcript`. Its session holds rows outside both windows: a `/model` command, a `/grill-me` command whose `typed` entry has `met: false`, and a skill load.
- **A session in a project no run has:** `project: "/Users/example/Scratch/notes"`.
- **A session with `start`, `end` and `project` null.**
- **A session titled "Port tidepool-api's retry to lantern-notes".**
- **`totals`** agree with the units by the reporter's rules, as the fixture convention says. In particular, these sums over every run and session match:
  - `dispatch_guard` sums the units' `refusals`
  - `startup` counts the sessions' `startup`
  - `scoreboard.advisor` and `totals.advisor` sum the units' `advisor` and `notes`
  - each `skills[].missing` adds the runs' `missing_skills` and every unit's unmet `typed`

- [ ] **Step 1: Write the failing tests.**
  - `load.test.ts`: report-v6 loads, and a session's `start`, `project`, `commands[0].name`, `advisor.by_role` and `refusals` parse.
  - `period-sessions.test.ts`: a session counts in its `start`'s week, and a session with no `start` counts in none.
- [ ] **Step 2: Run** `pnpm vitest run packages/shared/test/load.test.ts packages/server/test/period-sessions.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Change dev:fixtures' default list. Update only the e2e assertions the new last fixture changes, then run `pnpm test:screens --update-snapshots` and commit the baselines.
- [ ] **Step 4: Run** `pnpm vitest run`, `pnpm typecheck`, the Playwright checks and `pnpm test:screens`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: the loader reads each session's start, end, project, commands and advisor, and runs' typed triggers`.

### Task 2: Picked projects' session warnings in showing mode

**Wave:** A

**Files:**
- Modify: `packages/server/src/views/scope.ts` (`showSession`)
- Modify: `packages/server/src/views/home.ts` (the feed's session warnings, in `homeView`'s feed part)
- Modify: `packages/server/src/views/compliance.ts` (its list's session warnings)
- Modify: `packages/server/test/showing.test.ts`, `home.test.ts` and `compliance.test.ts`

**Interfaces:**
- `showSession(scope: Scope | null, project: string | null | undefined): boolean` in `scope.ts`. With no scope it is true. With a scope it is true only when `project` is set and `scope.shown.has(projectKey(projectRoot(project)))`.
- **The feed and Compliance's list:** a session warning stays, with a scope, when `showSession` holds for its session's `project`. It is shown through `showWarning`, so its `sessionId` is null and its text masked. The view's `hidden` counts the ones left out.
- **Unchanged:** the counts (Home's step boxes and tiles, Compliance's cells), which already count every session.

- [ ] **Step 1: Write the failing tests** on report-v6, with showing set to lantern-notes:
  - Compliance's list holds the lantern-notes session's warning, masked, with `sessionId` null.
  - It doesn't hold the Scratch session's warning, nor the warning of the session with no project, and `hidden` counts both.
  - Home's feed holds the lantern-notes session warning.
  - `leaks` finds nothing on `/api/home` or `/api/compliance?resolved=1&weeks=52`.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/showing.test.ts packages/server/test/home.test.ts packages/server/test/compliance.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run packages/server` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: picked projects' session warnings show in showing mode`.

**Conventions lines for the report:**
- The showing line: with a scope, a session or its warning is listed only when `showSession` holds.
- Compliance's line no longer leaves out every session warning.

### Task 3: The reporter's totals become period sums

**Wave:** A

**Files:**
- Modify: `packages/server/src/views/steps.ts`, `views/skills.ts` and `views/models.ts`
- Modify: `packages/shared/src/api/steps.ts`, `api/skills.ts` and `api/models.ts`
- Modify: `routes.ts` (the steps and models blocks pass sessions)
- Modify: `packages/server/test/steps.test.ts`, `skills.test.ts` and `models.test.ts`
- Modify: `packages/web/src/steps/StepsPage.tsx`, `skills/SkillsPage.tsx` and `models/ModelsPage.tsx`, with their stories
- Modify: `packages/web/src/test/steps.ts`, `test/skills.ts` and `test/models.ts`

**Interfaces:**
- `unitSums(runs: RunEntry[], sessions: SessionEntry[]): UnitSums`, in `steps.ts`, where `UnitSums = { dispatchGuard: Record<string, number> | null; startup: { with: number; without: number } | null; advisor: { calls; cost; tokens; byRole; failed; notes; changed; missing; share } | null }`. It follows the reporter's rules (CR6 section 1):
  - `dispatchGuard` sums `refusals`.
  - `startup` counts the sessions' `startup`.
  - `advisor` sums the units' `advisor` and `notes`, where `share` is `100 × cost / (cost + Fable dollars)`. The Fable dollars are the sum of the units' `advisor.weeks[].fable`, as `share_pct` computes them, and `share` is 0 when both are 0.
  - Each figure is null when no unit carries its key.
- **The period's units:** runs by finish, sessions through `periodSessions`.
- **`StepsResponse`:** `rules` gains `dispatchGuard`, `startup` and `advisor`, and the `reporter` group goes.
- **`ModelsResponse.advisor`:** its `facts` come from `unitSums`, except `trial`, which stays the reporter's. Its `weeks` stay the reporter's rows.
- **`skillSums`** gains `missing`: the runs' `missing_skills`, plus every unit's `typed` with `met: false`, by skill. `SkillsResponse.missingSource` goes.
- **On the pages,** those figures lose their `ReporterMark`. The trial, the weekly table, the mismatches, "differs" and the stage table keep it.

- [ ] **Step 1: Write the failing tests.**
  - Over every unit of report-v6:
    - `unitSums` equals `totals.scoreboard.dispatch_guard`, `.startup` and `.advisor`, and `totals.advisor`'s calls, tokens, cost, by_role, failed and notes, cost to the cent.
    - `skillSums`' `missing` equals `totals.skills[name].missing`.
  - A narrower period drops a unit outside it.
  - On report-full, which has no CR6 keys, the three figures are null.
  - The pages' stories show those figures without their marks.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/steps.test.ts packages/server/test/skills.test.ts packages/server/test/models.test.ts packages/web/src/steps packages/web/src/skills packages/web/src/models`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run`, `pnpm typecheck`, the Playwright checks and `pnpm test:screens`, leaving `shell.screens.ts` out. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: dispatch-guard refusals, startup, the advisor's facts and skills' missing become period sums over runs and sessions`.

Conventions line for the report: the reporter-sourced line lists only mismatches, "differs", the stage table, the trial and the advisor's weekly table, and the units' advisor, refusals and startup are summed only by `unitSums`.

### Task 4: Home's skills and commands

**Wave:** A

**Files:**
- Modify: `packages/shared/src/api/home.ts` (`UsageRow`, `HomeResponse.usage`)
- Modify: `packages/server/src/views/home.ts` (`usageSums`, called in `homeView`)
- Modify: `routes.ts` (the home block passes sessions, if it doesn't already)
- Modify: `packages/server/test/home.test.ts`
- Create: `packages/web/src/home/SkillsAndCommands.tsx` with its stories
- Modify: `packages/web/src/home/HomePage.tsx` and its stories
- Modify: `packages/web/src/test/home.ts`
- Modify: the home screens baseline

**Interfaces:**
- `UsageRow = { name: string; kind: 'skill' | 'command'; sessions: number; runs: number | null; typed: number; typedNeverLoaded: number | null }`.
- `usageSums(runs: RunEntry[], sessions: SessionEntry[], scope: Scope | null): { sessions: number; runs: number; rows: UsageRow[] }`, with the rows by `sessions` descending:
  - **Loads:** they come from `skillSums`, over the runs and over the sessions separately, with names masked first under a scope, as `skillsView` does.
  - **A skill row:**
    - `sessions` counts the sessions that loaded it or typed a command of its name
    - `runs` counts the runs that loaded it
    - `typed` counts the commands of its name
    - `typedNeverLoaded` counts the unmet `typed`
  - **A command row:** a command that no skill has. Its `runs` and `typedNeverLoaded` are null.
- `HomeResponse.usage = { lastWeek: ReturnType<typeof usageSums>; lastFourWeeks: ... }`, declared in shared:
  - the runs finished in the last 7 days, the diagram's window (`recent`), and the sessions started in them
  - the same for the last 28 days
- **`SkillsAndCommands({ usage })`:** a "Last 7 days / Last 4 weeks" switch (the `Option` convention), then the mockup's columns, with a share-of-sessions bar in one hue and its number beside it.

- [ ] **Step 1: Write the failing tests.**
  - In `home.test.ts`, on report-v6:
    - the `grill-me` row has `typedNeverLoaded` 1
    - the `model` row is a command with `runs` null
    - `sessions` counts the two-run session once
    - with showing on, `leaks` finds nothing
  - Stories: Empty and Full for the section, plus the HomePage story with it.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/home.test.ts packages/web/src/home`. Expected: FAIL.
- [ ] **Step 3: Implement,** with the `dataviz` skill loaded for the bar.
- [ ] **Step 4: Run** the full checks, as in Task 3. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: Home's skills and commands across the last 7 and 28 days' sessions and runs`.

### Task 5: The Sessions page

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
- Create: `e2e/sessions.spec.ts`
- Create: `e2e/sessions.screens.ts` with its baseline
- Modify: the menu baseline

**Interfaces:**
- `SessionRow = { key: string; title: string | null; sessionId: string | null; projectKey: string | null; project: string | null; start: string | null; end: string | null; minutes: number | null; models: { model: string; effort: string | null }[]; cost: number | null; startup: boolean | null; warnings: number; holds: { runKey: string; project: string; branch: string | null; path: Path | null }[]; timeline: { at: string; kind: 'skill' | 'command' | 'run'; name: string; outcome: string | null; neverLoaded: boolean; runKey: string | null }[] }`.
- `SessionsResponse = { sessions: SessionRow[]; hidden: number }`: newest start first, with sessions that have no start last.
- `sessionsView({ runs, sessions, warnings, query, now, scope })`:
  - **Filters:**
    - The period keeps sessions through `periodSessions`.
    - The project filter is a key.
    - The path filter keeps sessions holding a run of that path.
    - "Has warnings" keeps sessions with a current warning.
  - **Fields:**
    - `project` comes from `storedNames(runs)`, or null for "other project".
    - `sessionId` is the file's UUID with no scope, and null with one.
    - `minutes` is `end` minus `start`.
    - `models` lists its `models`' keys by cost, each with its most-used effort from `efforts`.
    - `holds` lists the runs whose `window.transcript` is its `file`, named through `storedFacts`.
    - `timeline` holds, in time order: skill loads (outcome through `skillOutcomeLabel`), commands (`neverLoaded` when an unmet `typed` entry has its name), and each held run's window start.
  - **With a scope:** only sessions where `showSession` holds are listed, titles and names go through `maskText`, and `hidden` counts the sessions left out.
- **The page:**
  - `ListFilters`, plus "has warnings"
  - `SessionsTable`, whose rows expand to the timeline as in the mockup
  - the columns "Skills loaded" and "Commands typed", listing the timeline's distinct skill and command names
  - the name: its title, or "no title"
  - `SessionChip` below the name whenever `sessionId` is set
  - "Holds" links to `/runs/$key`
- **Route:** `GET /api/sessions`, through `periodQuery`, plus `warnings=1`.

- [ ] **Step 1: Write the failing tests.**
  - In `sessions.test.ts`, on report-v6:
    - The two-run session holds both runs.
    - Its `/grill-me` is `neverLoaded`.
    - Its timeline orders the skill, the commands and both window starts.
    - The session with no start is listed last, and only in the 52-week period.
    - With showing on lantern-notes: the Scratch session isn't listed and `hidden` counts it, the title naming tidepool-api is masked, no `sessionId` is set, and `leaks` finds nothing.
  - Stories: Empty, Full (with an interaction that expands a row), Loading and Error.
  - The e2e: open Sessions from the menu, expand the two-run session, and follow its run link, with no axe violations.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/sessions.test.ts packages/web/src/sessions`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run`, `pnpm typecheck`, the Playwright checks and `pnpm test:screens`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: the Sessions page: each session's facts, commands, held runs and timeline`.

### Task 6: check:real compares the new sums and checks the sessions route for leaks

**Files:**
- Modify: `packages/server/src/check-real.ts`
- Modify: `packages/server/test/check-real.test.ts`
- Modify: `README.md`

**Interfaces:** consumes `unitSums` and `skillSums`' `missing`.

**What changes:**
- `check:real` gains `units: <n> differ`, comparing `dispatch_guard`, `startup` and the advisor's summed facts with the totals.
- Its `skills:` line also compares `missing`.
- Like the existing lines, it prints only keys no project can name.
- The showing check adds `/api/sessions?weeks=52`.

- [ ] **Step 1: Write the failing test.** On report-v6, check:real prints `units: 0 differ` and `showing: pass`, and no line contains `/Users/`.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/check-real.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: check:real compares the units' sums with the reporter and checks the sessions route for leaks`.
