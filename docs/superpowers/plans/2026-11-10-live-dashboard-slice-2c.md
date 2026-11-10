# Live dashboard, slice 2c ("Sessions, skills and commands, the reporter's totals as sums") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- A Sessions page on CR11's session facts.
- Home's skills-and-commands section.
- Session warnings come back in showing mode for picked projects.
- 2b's "reporter, all time" figures become period sums over CR6's units, compared by `check:real`.

**Architecture:**
- **The loader** reads CR6's and CR11's keys, which a new invented fixture holds. Sessions gain `start`, `end`, `project`, `commands`, `advisor`, `notes` and `refusals`. Runs gain `typed` and the wider `advisor`.
- **Merging:** the reporter's sparse count maps replace, rather than merge, so the sums never count a row twice once it moves from a session to a run.
- **Session projects:** a session gets a project through `projectRoot`, as a run does. The scope shows picked projects' sessions and their warnings, and hides every other root, run or session alike.
- **The new figures** are pure sums in the views that already show them, each checked against the reporter's totals.

**Tech Stack:** as slice 2b.

**Spec:** `docs/superpowers/specs/2026-11-09-live-dashboard-design.md`, the "Slice 2 design" section's 2c part and decision 52.

**Mockup:** `docs/design/2026-11-10-slice-2c/sessions.html`.

**The reporter's keys:** read with `git -C ~/Work/claude-workflow show origin/main:<path>`:
- `docs/superpowers/specs/2026-11-09-incremental-export-design.md`, sections 1 and 5
- `docs/superpowers/specs/2026-11-10-session-facts-design.md`, sections 1, 2 and 6
- `scripts/workflow-report.py`: `report_data`, `run_entry`, `scoreboard`, `advisor_facts`, `skill_totals`, `refusal_counts`, `unit_advisor`

## Global Constraints

- **As in 2b:**
  - Read no real data, and use invented fixtures only.
  - Every new `report.ts` field is `.nullish()`, and only the fields the dashboard reads.
  - A sum over units lives in its view as an exported pure function, and `check:real` compares it.
  - A period is `periodQuery` and `period`.
  - Showing mode applies only in views, through `scope.ts`, and every view's tests run `leaks`.
  - Display text lives in `format.ts`.
  - A new page gets a menu entry, a route, `ListFilters`, stories (Empty, Full, Loading and Error), an axe check and a screenshot.
- **Sessions:**
  - A session counts in the week of its `start`, and only through `periodSessions` (Task 1). A session with no `start` counts in no period and is never listed.
  - A session's project is `projectRoot(session.project)`.
  - A session is in a known project when that root is a stored run's root. It is then named, keyed and filtered as runs are, and with a scope it shows through the scope's names.
  - Any other root, or no `project`, is "other project". It has no key, is never pickable and is never listed with a scope, but still counts in sums.
- **The filters, in the sums:**
  - A project filter keeps a session whose root has that key.
  - A path filter leaves sessions out, since a session has no path.
- **A slash command** is CR11's `{ name, time }`, and the schema reads nothing else from it.
  - A command `x:y` (a plugin skill's command) names skill `y`.
  - A skill's "typed" counts its `typed` triggers, phrases included. A command no skill has counts as typed by its commands.
- **Showing mode:**
  - It lists a session or its warning when `showSession` holds, and a held run when `showFacts` does.
  - Every name or title from a unit (skill and command names, session titles) goes through `maskText`.
  - The scope's hidden names are the folder names of every stored root, runs' and sessions' alike, that isn't shown.
  - A session ID never leaves the backend.
- **Figures that stay the reporter's:**
  - the agents' mismatches
  - the main sessions' "differs" and stage table, still read from `totals.models.main[path].recommended`, which CR11 keeps equal to the new `stage_table`
  - the advisor's trial and its weekly table

  Every other figure 2b marked "reporter, all time" becomes a sum.
- **Failing-test check, waves, `E2E_PORT` and the menu baseline:** as in 2b's plan.
  - A wave task runs Playwright on `E2E_PORT` 4400 plus its task number, and leaves `shell.screens.ts` out.
  - The session re-renders the menu baseline after each wave merges.
- **Commit messages** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A session with no `start`, no `project`, or a project that's no stored run's root.** It is never listed in a period, or it shows as "other project". With a scope, it is never listed and its folder name is masked, but it still counts in sums. Pinned in Tasks 3 and 6.
2. **A transcript holding two runs, one of them in a hidden project.**
   - Its session's "Holds" lists both runs with no scope, and only the shown one with a scope.
   - A command typed inside a run window and never loaded is marked.

   Pinned in Task 6.
3. **An export from before CR6:** runs have `refusals` and `advisor`, but sessions have no `refusals` and advisors have no `by_role`. The new figures are null there, never partial sums. Pinned in Task 4.
4. **A session moving its rows to a run between imports:** a key that vanishes from a count map no longer counts. Pinned in Task 2.
5. **The period sums against the reporter's all-time totals.** Over every unit they equal the reporter's totals, cost to the cent and share to 0.01 points. Pinned in Tasks 4 and 7.

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
- `SessionEntrySchema` gains `start: str`, `end: str`, `project: str`, `commands: z.array(z.object({ name: str, time: str })).nullish()`, `advisor: UnitAdvisorSchema.nullish()`, `notes: z.object({ notes: num, changed: num, missing: num }).nullish()` and `refusals: counts`.
- `periodSessions(sessions: StoredUnit<SessionEntry>[], weeks: string[]): StoredUnit<SessionEntry>[]` in `views/runs.ts` returns the sessions whose `start` week (`weekOf(parseTime(start))`) is one of `weeks`.

**The fixture `report-v6.json`** is report-v5's units, invented, plus CR6's and CR11's keys. It holds:
- **On every unit:** each session gets `start`, `end`, `project`, `commands`, `advisor`, `notes` and `refusals`, and each run gets `typed`.
- **A transcript holding two runs.** The transcript is in `/Users/example/Work/lantern-notes`, and it holds the lantern-notes plan run and the tidepool-api `feature/webhooks` run, the second after the session moved directory. Its session's rows outside both windows include:
  - a `/model` command
  - a `/grill-me` command whose `typed` entry, with the same time, has `met: false`
  - a skill load
  - a `startup_missing` warning

  Inside the tidepool window, the run's `typed` holds an unmet `grill-me`, with a `/grill-me` command at the same time on the session.
- **A tidepool-api session** titled "Port lantern-notes' sync to tidepool-api", with a `startup_missing` warning.
- **A session in `/Users/example/Scratch/notes`,** a project no run has, with a `startup_missing` warning.
- **A session with `start`, `end` and `project` all null,** with an `unrecorded_session` warning.
- **A `/superpowers:brainstorming` command** on one session, which loaded `brainstorming`.
- **`totals`** that agree with the units by the reporter's rules, as the fixture convention says. In particular, over every run and session:
  - `dispatch_guard` sums the units' `refusals`
  - `startup` counts the sessions' `startup`
  - `scoreboard.advisor` and `totals.advisor` sum the units' `advisor` and `notes`
  - each `skills[].missing` adds the runs' `missing_skills` and every unit's unmet `typed`

- [ ] **Step 1: Write the failing tests.**
  - In `load.test.ts`: report-v6 loads, and a session's `start`, `project`, `commands[0].name`, `advisor.by_role` and `refusals` parse.
  - In `period-sessions.test.ts`: a session counts in its `start`'s week, and a session with no `start` counts in none.
- [ ] **Step 2: Run** `pnpm vitest run packages/shared/test/load.test.ts packages/server/test/period-sessions.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Change dev:fixtures' default list. Update only the e2e assertions the new last fixture changes, then run `pnpm test:screens --update-snapshots` and commit the baselines.
- [ ] **Step 4: Run** `pnpm vitest run`, `pnpm typecheck`, the Playwright checks and `pnpm test:screens`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: the loader reads each session's start, end, project, commands and advisor, and runs' typed triggers`.

### Task 2: Count maps replace, rather than merge

The stored derived values are a risk area.

**Files:**
- Modify: `packages/server/src/db/merge.ts`
- Modify: `packages/server/test/merge.test.ts` and `import.test.ts`

**Interfaces:**
- `mergeKnown` replaces these values whole when the new version holds a non-null value, and keeps the old value when the new one is null or absent, as it does today. A key the new map lacks then stops counting. The values:
  - a unit's `refusals`, `models` and `efforts`
  - its `advisor.tokens`, `advisor.by_role`, `advisor.failed` and `advisor.weeks`
  - its `notes`
- Everything else merges as today.
- `main.ts` already rebuilds the derived values at start, so every stored unit takes the new rule.

- [ ] **Step 1: Write the failing tests.**
  - In `merge.test.ts`:
    - A session stored with `refusals: { no_model: 1 }`, then `refusals: {}`, merges to `{}`.
    - `advisor.by_role` follows the same rule.
    - A `null` `refusals` keeps the stored value.
  - In `import.test.ts`: `rebuildDerived` gives the same rows.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/merge.test.ts packages/server/test/import.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run packages/server` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit:** `fix: the reporter's count maps replace rather than merge, so a row that moves from a session to a run counts once`.

Conventions line for the report: the stored-derived-values line adds that `mergeKnown` replaces the reporter's count maps whole (named in `merge.ts`).

### Task 3: Showing mode: session warnings and every root's names

**Wave:** A

**Files:**
- Modify: `packages/server/src/views/scope.ts` (`scopeOf`'s hidden names, `showSession`, `forbiddenStrings`)
- Modify: `packages/server/src/routes.ts` (`scopeFor` passes the stored sessions' roots)
- Modify: `packages/server/src/views/home.ts` (the feed part only)
- Modify: `packages/server/src/views/compliance.ts` (its list's session warnings)
- Modify: `packages/server/src/check-real.ts` (its `forbiddenStrings` call passes sessions' roots)
- Modify: `packages/server/test/showing.test.ts` and `compliance.test.ts`, and `home.test.ts` (the feed's tests only)

**Interfaces:**
- `scopeOf(showing, branches, aliases, sessionRoots: string[])`: `hidden` also holds the folder names of `sessionRoots` that no shown root has. The picker still lists only runs' projects.
- `forbiddenStrings(...)` gains `sessionRoots` the same way.
- `showSession(scope: Scope | null, project: string | null | undefined): boolean`. With no scope, it is true. With a scope, it is true only when `project` is set and `scope.shown.has(projectKey(projectRoot(project)))`.
- **The feed and Compliance's list:** a session warning stays, with a scope, when `showSession` holds for its session's `project`. It goes through `showWarning`, so `sessionId` is null and the text is masked. `hidden` counts the ones left out.
- **Unchanged:** the counts.

- [ ] **Step 1: Write the failing tests,** on report-v6 with showing set to lantern-notes:
  - Compliance's list:
    - holds the lantern-notes session's warning, masked, with `sessionId` null
    - doesn't hold the tidepool, Scratch or no-project sessions' warnings, and `hidden` counts them
  - Home's feed holds the lantern-notes session warning.
  - `maskText` turns "notes" in a shown text into "another project", the Scratch root's folder name.
  - `leaks`, with the new `forbiddenStrings`, finds nothing on `/api/home` or `/api/compliance?resolved=1&weeks=52`.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/showing.test.ts packages/server/test/home.test.ts packages/server/test/compliance.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run packages/server` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: picked projects' session warnings show in showing mode; every other root's name is hidden`.

**Conventions lines for the report:**
- The showing line gains `showSession`, and the hidden names now come from runs' and sessions' roots.
- Compliance's line no longer leaves out every session warning.

### Task 4: The reporter's totals become period sums

**Wave:** A

**Files:**
- Modify: `packages/server/src/views/steps.ts`, `views/skills.ts` and `views/models.ts`
- Modify: `packages/shared/src/api/steps.ts`, `api/skills.ts` and `api/models.ts`
- Modify: `routes.ts` (the steps, skills and models blocks only)
- Modify: `packages/server/test/steps.test.ts`, `skills.test.ts` and `models.test.ts`
- Modify: the web pages `StepsPage.tsx`, `SkillsPage.tsx` and `ModelsPage.tsx`, their stories, and `test/steps.ts`, `test/skills.ts` and `test/models.ts`
- Modify: `packages/web/e2e/steps.spec.ts` and `skills.spec.ts`, which assert the dropped marks
- Modify: the steps, skills and models screens baselines

**Interfaces:**
- `unitSums(runs: RunEntry[], sessions: SessionEntry[]): UnitSums` in `steps.ts`, where `UnitSums = { dispatchGuard: Record<string, number> | null; startup: { with: number; without: number } | null; advisor: { calls; cost; tokens; byRole; failed; notes; changed; missing; share } | null }`. It follows CR6 section 1's rules:
  - **`dispatchGuard`** sums the units' `refusals`. It is null unless some session in the input carries `refusals`, which only CR6 gives sessions.
  - **`startup`** counts the sessions' `startup`, under the same marker.
  - **`advisor`** sums the units' `advisor` and `notes`, and is null unless some unit's `advisor` has `by_role`.
    - `share` is `100 × cost / (cost + Fable dollars)`. The Fable dollars are the sum of the units' `advisor.weeks[].fable`, as `share_pct`, and the share is 0 when both are 0.
- **The period's units:** runs by finish, sessions through `periodSessions`, then the Global Constraints' filters.
- **`StepsResponse`:** `rules` gains `dispatchGuard`, `startup` and `advisor`. Its `reporter` group goes.
- **`ModelsResponse.advisor`:** its `facts` come from `unitSums`, except `trial`, which stays the reporter's. Its `weeks` stay the reporter's rows.
- **`skillSums`** keeps its loads' rule. `SkillRow` gains `missing`, which is:
  - the period's runs' `missing_skills`
  - plus the `typed` entries with `met: false` of every period unit (runs by finish, sessions by start)

  It is summed in its own pass and joined onto the rows by name, adding a row for a skill that is only missing. `SkillsResponse.missingSource` goes.
- **On the pages:** these figures lose their `ReporterMark`.

- [ ] **Step 1: Write the failing tests.**
  - Over every unit of report-v6:
    - `unitSums` equals `totals.scoreboard.dispatch_guard`, `.startup` and `.advisor`, and `totals.advisor`'s calls, tokens, cost, by_role, failed and notes, with cost to the cent and share to 0.01.
    - Each skill's `missing` equals `totals.skills[name].missing`.
  - A narrower period, or a project filter, drops a unit, and a path filter leaves sessions out.
  - On report-full, the three figures are null.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/steps.test.ts packages/server/test/skills.test.ts packages/server/test/models.test.ts packages/web/src/steps packages/web/src/skills packages/web/src/models`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run`, `pnpm typecheck`, the Playwright checks on `E2E_PORT`, and `pnpm test:screens` with `shell.screens.ts` left out. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: dispatch-guard refusals, startup, the advisor's facts and skills' missing become period sums over runs and sessions`.

Conventions line for the report: the reporter-sourced line lists only mismatches, "differs", the stage table, the trial and the advisor's weekly table, and the units' advisor, refusals and startup are summed only by `unitSums`.

### Task 5: Home's skills and commands

**Files:**
- Modify: `packages/shared/src/api/home.ts` (`UsageRow`, `HomeResponse.usage`)
- Modify: `packages/server/src/views/home.ts` (`usageSums`, called in `homeView`)
- Modify: `packages/server/test/home.test.ts`
- Create: `packages/web/src/home/SkillsAndCommands.tsx` with its stories
- Modify: `packages/web/src/home/HomePage.tsx` and its stories, and `packages/web/src/test/home.ts`
- Modify: the home screens baseline

**Interfaces:**
- `UsageRow = { name: string; kind: 'skill' | 'command'; sessions: number; runs: number | null; typed: number; typedNeverLoaded: number | null }`.
- `usageSums(runs: RunEntry[], sessions: SessionEntry[], scope: Scope | null): { sessions: number; runs: number; rows: UsageRow[] }`, with its rows ordered by `sessions`, descending:
  - **Skill rows:** loads come from `skillSums`, over the runs and over the sessions separately, with names masked first under a scope.
    - `sessions` counts the sessions that loaded the skill or typed a command naming it.
    - `runs` counts the runs that loaded it.
    - `typed` counts its `typed` triggers on runs and sessions.
    - `typedNeverLoaded` counts the unmet ones.
  - **Command rows:** a command that names no skill. `typed` counts its commands, and `runs` and `typedNeverLoaded` are null.
- `HomeResponse.usage = { thisWeek, lastFourWeeks }`, each a `usageSums` over `period(1)`'s and `period(4)`'s runs and their `periodSessions`.
- **`SkillsAndCommands({ usage })`:** a "This week / Last 4 weeks" switch (the `Option` convention), then the mockup's columns. The share-of-sessions bar is one hue, with its number beside it.

- [ ] **Step 1: Write the failing tests.**
  - In `home.test.ts`, on report-v6:
    - `grill-me`'s `typedNeverLoaded` is 2, once on the session and once on the tidepool run.
    - `model` is a command with `runs` null.
    - `/superpowers:brainstorming` counts on the `brainstorming` row.
    - `sessions` counts the two-run session once.
    - `leaks` finds nothing with showing on.
  - Stories: the section's Empty and Full, and the HomePage story with the section.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/home.test.ts packages/web/src/home`. Expected: FAIL.
- [ ] **Step 3: Implement,** with the `dataviz` skill loaded for the bar.
- [ ] **Step 4: Run** the full checks. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: Home's skills and commands over this week's and the last four weeks' sessions and runs`.

### Task 6: The Sessions page

**Files:**
- Create: `packages/shared/src/api/sessions.ts`
- Modify: `index.ts` (one line)
- Create: `packages/server/src/views/sessions.ts`
- Modify: `routes.ts` (a sessions block)
- Create: `packages/server/test/sessions.test.ts`
- Create: `packages/web/src/sessions/SessionsPage.tsx` and `SessionsTable.tsx`, with their stories
- Create: `packages/web/src/test/sessions.ts`
- Modify: `router.tsx` (`/sessions`) and `Menu.tsx` (Sessions, after Findings)
- Create: `e2e/sessions.spec.ts` and `e2e/sessions.screens.ts`, with the latter's baseline
- Modify: the menu baseline

**Interfaces:**
- `SessionRow = { key: string; title: string | null; sessionId: string | null; projectKey: string | null; project: string | null; start: string; end: string | null; minutes: number | null; models: { model: string; effort: string | null }[]; cost: number | null; startup: boolean | null; warnings: number; holds: { runKey: string; project: string; branch: string | null; path: Path | null }[]; timeline: { at: string; kind: 'skill' | 'command' | 'run'; name: string; outcome: string | null; neverLoaded: boolean; runKey: string | null }[] }`.
- `SessionsResponse = { sessions: SessionRow[]; hidden: number }`, newest start first.
- `sessionsView({ runs, sessions, warnings, query, now, scope })`:
  - **Filters:** sessions come through `periodSessions`. The project filter matches the session's key. The path filter keeps sessions holding a run of that path. "Has warnings" keeps sessions with a current warning.
  - **`project`:** with no scope, the name from `storedNames(runs)`. With a scope, the scope's name, so aliases apply. Null for "other project".
  - **`sessionId`:** the file's UUID with no scope, null with one.
  - **`minutes`:** `end` minus `start`.
  - **`models`:** its `models`' keys by cost, each with its most-used effort from `efforts`.
  - **`holds`:** the runs whose `window.transcript` is its `file`, each through `storedFacts` and then `showFacts(scope, …)`. A hidden run is left out, and named with the scope's names.
  - **`timeline`,** in time order:
    - skill loads, with their outcome through `skillOutcomeLabel`
    - commands, where `neverLoaded` marks a command whose name (after any `x:`) and time equal an unmet `typed` entry's skill and time, on the session or on a held run
    - each held run's window start, for shown runs only
  - **With a scope:** only sessions where `showSession` holds are listed. Titles and names go through `maskText`, and `hidden` counts the sessions left out.
- **The page:**
  - `ListFilters`, plus "has warnings".
  - `SessionsTable` with expandable rows, as in the mockup. "Skills loaded" and "Commands typed" list the timeline's distinct names.
  - The name is its title, or "no title", with `SessionChip` below it whenever `sessionId` is set.
  - "Holds" links to `/runs/$key`.
- **Route:** `GET /api/sessions`, through `periodQuery`, plus `warnings=1`.

- [ ] **Step 1: Write the failing tests.**
  - In `sessions.test.ts`, on report-v6:
    - The two-run session holds both runs.
    - Both `/grill-me` commands are `neverLoaded`, and `/model` isn't.
    - Its timeline orders the skill, the commands and both window starts.
    - The session with no start is never listed.
  - With showing on lantern-notes:
    - The two-run session holds only the plan run, and its timeline shows one window.
    - The tidepool, Scratch and no-project sessions aren't listed, and `hidden` counts them.
    - No `sessionId` is set.
    - `leaks` finds nothing.
  - Stories: Empty, Full (with an interaction that expands a row), Loading and Error.
  - The e2e: open Sessions from the menu, expand the two-run session, follow its run link, and find no axe violations.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/sessions.test.ts packages/web/src/sessions`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run`, `pnpm typecheck`, the Playwright checks and `pnpm test:screens`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: the Sessions page: each session's facts, commands, held runs and timeline`.

### Task 7: check:real compares the new sums and checks the sessions route for leaks

**Files:**
- Modify: `packages/server/src/check-real.ts`
- Modify: `packages/server/test/check-real.test.ts`
- Modify: `README.md`

**Interfaces:** consumes `unitSums` and `SkillRow.missing`.

**`check:real`'s changes:**
- It gains `units: <n> differ`. That line compares `dispatch_guard`, `startup` and the advisor's summed facts with the totals, with cost to the cent and share to 0.01 points.
- Its `skills:` line also compares `missing`.
- Lines print only keys that no project can name.
- The showing check adds `/api/sessions?weeks=52`.

- [ ] **Step 1: Write the failing test.** On report-v6, check:real prints `units: 0 differ` and `showing: pass`, and no line contains `/Users/`.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/check-real.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: check:real compares the units' sums with the reporter and checks the sessions route for leaks`.
