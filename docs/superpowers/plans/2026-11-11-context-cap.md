# Context cap, handoff chain and sweeper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- The dashboard reads the reporter's three new facts per unit (`context`, `tool_results`, `sweeps`), `totals.context` and `totals.health.info`.
- A Context page shows the weekly trend and the runs and sessions behind it.
- A run's page shows its context facts.
- Compliance shows the reporter's information lines.

**Architecture:**
- **The loader** reads the new keys as `.nullish()` fields, from a new invented fixture, `report-v7`.
- **Merging:** `mergeKnown` replaces the three facts whole and reads them as a group, so a session whose calls moved to a run stops counting them.
- **The weekly sums** are a new pure `contextSums` beside `weekSums`, the reporter's `context_rows`, which `check:real` compares with `totals.context`.
- **The page's response** is a pure `contextView` of the stored units. The information lines are a reporter figure, read through `reporterTotals`.

**Tech Stack:** as slice 2c.

**Spec:** `docs/superpowers/specs/2026-11-10-context-cap-design.md` (approved 2026-11-11).

**Mockup:** `docs/design/2026-11-10-context-cap/context.html`.

**The reporter's keys:** issue [shoklah/claude-workflow-dashboard#16](https://github.com/shoklah/claude-workflow-dashboard/issues/16) and `~/.claude/scripts/workflow-report.py` (`context_facts`, `context_rows`, `context_info`).

## Global Constraints

- **As in 2c:**
  - Read no real data, and use invented fixtures only. The issue's real numbers go nowhere in this repo.
  - Every new `report.ts` field is `.nullish()`, and only the fields the dashboard reads.
  - A sum over units is an exported pure function in its view, and `check:real` compares it.
  - A period is `periodQuery` and `period`.
  - Showing mode applies only in views, through `scope.ts`, and every view's tests run `leaks`.
  - Display text lives in `format.ts`.
  - A new page gets a menu entry, a route, `ListFilters`, stories (Empty, Full, Loading and Error), an axe check and a screenshot.
- **The facts:**
  - All three are null on a run with no transcript window: unknown, never zero.
  - `context` alone is null, with `tool_results` and `sweeps` zeros, on a unit whose transcript was read but has no main call of its own.
  - `tool_results` is a `counts` map, so a class the reporter adds later still sums.
- **Weeks:** a run counts in `weekOf(parseTime(record.date))`, a session in `weekOf(parseTime(start))`, and only units whose `context` isn't null count.
- **The cap:** `CONTEXT_CAP = 300_000`, the app's default until CR14. The page says so.
- **The charts:** ECharts under the chart conventions, with the `dataviz` skill loaded.
  - The cap is a dashed reference line labelled "cap 300K", in the chart's ink, never a series colour.
  - Tokens and characters show compact ("281K", "1.3M").
- **Failing-test check, waves, `E2E_PORT` and the menu baseline:** as in 2b's plan.
  - The check: `/usr/bin/python3 -I ~/.claude/scripts/failing-test-check.py --base <task start SHA> --link node_modules --link packages/shared/node_modules --link packages/server/node_modules --link packages/web/node_modules --timeout 240 -- pnpm vitest run <the task's test files>`, with a `--test-file` for each.
  - A wave task runs Playwright with `E2E_PORT` 4400 plus its task number, and leaves `shell.screens.ts` out.
  - The session re-renders the menu baseline after Wave C merges.
- **Commit messages** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A session whose calls move to its run between two imports (CR6).** Its new version has `context: null` with known `tool_results`, so its stored `context` becomes null and the Context page counts those calls once. Pinned in Task 2.
2. **A unit the reporter couldn't read:** a run with no window, or a unit stored before the change. It never counts as zero and is never listed, but it counts in `uncounted`. A later version with all three facts null keeps the stored ones. Pinned in Tasks 2 and 5.
3. **A week, or a whole period, with no context.** Every count is 0, and the mean, largest and read share are null: a gap in the charts, "–" in the table, never "NaN" or "0%". The list shows its empty line. Pinned in Tasks 3 and 7.
4. **Showing mode on a project with a session that hands off to a session in a hidden root, and an information line naming a hidden branch.**
   - The successor shows as "–".
   - The lines are hidden and counted.
   - The sums don't change.
   - `leaks` finds nothing.

   Pinned in Tasks 4 and 5.
5. **An export from before the change:** no facts, no `totals.context`, no `health`.
   - The Context page has empty weeks, an empty list and every unit in `uncounted`.
   - Compliance has no information section.
   - `check:real` prints `context: not in the export`.

   Pinned in Tasks 4, 5 and 8.

---

### Task 1: The loader reads the three facts, the weekly context totals and the information lines

**Files:**
- Modify: `packages/shared/src/report.ts`
- Create: `packages/shared/fixtures/report-v7.json`
- Modify: `packages/shared/test/load.test.ts`
- Modify: `packages/server/src/dev-fixtures.ts`: the default list becomes `['report-full', 'report-later', 'report-v6', 'report-v7']`
- Modify: the e2e files' fixture comments, and any assertion the fourth import changes
- Modify: `CLAUDE.md`, the fixture totals line: its rules gain `context_rows`

**Interfaces:**
- **New schemas** in `report.ts`, beside the helpers:
  - `ContextSchema = z.object({ calls: num, tokens: num, median_tokens: num, max_tokens: num, over_cap: bool, calls_over_cap: num, handoff: str, handoff_to: str })`. `handoff_to` is CR15's proposed field, the successor session's reporter `key`.
  - `SweepsSchema = z.object({ inline: num, delegated: num })`
- **`RunEntrySchema` and `SessionEntrySchema`** gain `context: ContextSchema.nullish()`, `tool_results: counts` and `sweeps: SweepsSchema.nullish()`.
- **`TotalsSchema`** gains:
  - `context: z.array(z.object({ week: str, calls: num, tokens: num, max_tokens: num, units_over_cap: num, tool_results: counts, sweeps: SweepsSchema.nullish() })).nullish()`
  - `health: z.object({ info: strings }).nullish()`

**The fixture `report-v7.json`** is report-v6's units and totals, plus the new keys, all invented. `now` and `generated` are unchanged.
- **Runs:**
  - **The three window-less runs** (tidepool-api `feature/rate-limits` and `fix/retry-backoff`, lantern-notes `chore/tidy-imports`) have all three facts null.
  - **The lantern-notes plan run** (Nov 8) is under the cap.
  - **The lantern-notes `feature/offline-sync` Full run** (Nov 10) is over the cap with no handoff, and has the most `calls_over_cap` of all units.
  - **The tidepool-api `feature/webhooks` run** (Nov 12) is over the cap with a `handoff`, and its `handoff_to` is a 16-hex key that matches no unit.
  - **The lantern-notes run with the HTML branch** (Nov 12) is under the cap.
- **Sessions:**
  - **"Release checklist draft"** (`Scratch/lantern`, Nov 5) is under the cap: the Nov 1 week's only context unit.
  - **"Offline sync plan"** (`5a9d3f12`, Nov 8) is over the cap with a `handoff`, and its `handoff_to` is the tidepool-api session's `key`.
  - **"Offline sync build"** (`7d1e4b90`, holding the Full run's window) has no calls outside that window: `context` null, all seven `tool_results` classes 0, and `sweeps` zeros.
  - **"Port lantern-notes' sync to tidepool-api"** (Nov 9) is over the cap with no handoff.
  - **The session with no `start`** has facts under the cap, and counts in no week.
- **The context facts are invented apart from the units' `models` and `efforts`.** No page or check compares a unit's spend with its context, so they need not agree.
- **Every read unit's `tool_results`** holds all seven classes (`read`, `edit`, `run`, `bash_other`, `agent`, `mcp`, `other`).
- **`totals.context`** has the Nov 1 and Nov 8 weeks, summed by the reporter's rules. Task 3's test checks that they agree.
- **`totals.health.info`** holds three lines:
  - an invented line naming tidepool-api's branch `feature/webhooks`
  - `inline sweeps: N`, with N the units' inline sweeps this week
  - `over the cap without a handoff: 1 transcripts`

- [ ] **Step 1: Write the failing test** in `load.test.ts`:
  - report-v7 loads.
  - The Full run's `context.calls_over_cap`, `tool_results.read` and `sweeps.delegated` parse.
  - A window-less run's `context`, `tool_results` and `sweeps` are null.
  - `reporterTotals` of its totals gives `context[1].units_over_cap` and `health.info` with three lines.
- [ ] **Step 2: Run** `pnpm vitest run packages/shared/test/load.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Change dev:fixtures' default list. Run `pnpm --filter @cwd/web exec playwright test --project=checks`, and update only what the fourth import changes. dev:fixtures dates each import an hour apart, so a fourth file moves the first three an hour earlier: Home's feed times change, as when 2b added the third. Re-render the changed baselines with `pnpm test:screens --update-snapshots` and commit them.
- [ ] **Step 4: Run** `pnpm vitest run`, `pnpm typecheck`, the Playwright checks and `pnpm test:screens`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: the loader reads each unit's context, tool results and sweeps, and the weekly context totals and information lines`.

### Task 2: `mergeKnown` reads the three facts as a group

**Wave:** A

The stored derived values are a risk area.

**Files:**
- Modify: `packages/server/src/db/merge.ts`
- Modify: `packages/server/test/merge.test.ts` and `packages/server/test/import.test.ts`
- Modify: `CLAUDE.md`, the `mergeKnown` line only (`COUNT_MAPS` …)

**Interfaces:**
- **`COUNT_MAPS`** gains `context: true`, `tool_results: true` and `sweeps: true`.
- **`mergeKnown(prev, next)`:** when `next` is an object whose `tool_results` isn't null or absent, the merged `context` is `next.context ?? null`, whatever `prev` held. Otherwise it merges as today: a null or absent value keeps the stored one.
- **The `CLAUDE.md` line** adds: "and when a version's `tool_results` isn't null, its `context` replaces the stored one, null included, since the reporter read the transcript".

- [ ] **Step 1: Write the failing tests.**
  - **In `merge.test.ts`:**
    - A stored `context` with `handoff` set, then a version with `context: null` and all-zero `tool_results`, merges to `context: null`.
    - A stored unit's three facts, then a version with all three null, are kept.
    - A new `context` with `handoff: null` replaces a stored one with `handoff` set: the merged `handoff` is null, and so is `handoff_to`.
    - A `tool_results` class the new map lacks stops counting.
  - **In `import.test.ts`:** import report-v7, then a version of the "Offline sync plan" session with `context: null` and zero `tool_results`. The stored merged `context` is null, and stays null after `rebuildDerived`.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/merge.test.ts packages/server/test/import.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: the three context facts replace whole, and a read transcript's null context replaces the stored one`.

### Task 3: `contextSums`, the reporter's weekly context rows

**Wave:** A

**Files:**
- Create: `packages/server/src/views/context.ts`
- Create: `packages/shared/src/api/context.ts`, and export it from `packages/shared/src/index.ts`
- Modify: `packages/shared/src/facts.ts`: `readShare`, beside `modelsCost`
- Create: `packages/server/test/context.test.ts`
- Modify: `CLAUDE.md`: a new line after the `weekSums` line

**Interfaces:**
- **In `packages/shared/src/api/context.ts`:**
  - `type ContextSums = { units: number; calls: number; tokens: number; maxTokens: number | null; unitsOverCap: number; toolResults: Record<string, number>; sweeps: { inline: number; delegated: number } }`
  - `type ContextWeek = ContextSums & { week: string; meanTokens: number | null; readShare: number | null }`
- **In `packages/shared/src/facts.ts`,** beside `modelsCost`, since a run's facts (Task 6) and the Context view both use it and `views/runs.ts` imports no other view: `readShare(toolResults: Record<string, number> | null | undefined): number | null`, `read` as a percent (0 to 100) of the sum of every class, null when the map is null or sums to 0.
- **In `views/context.ts`:**
  - `contextSums(runs: RunEntry[], sessions: SessionEntry[]): Map<string, ContextSums>`, keyed by week start date. It skips a unit with a null `context` or no week. It sums `toolResults` by class and `sweeps` by kind, a missing class or kind counting 0. `maxTokens` is the largest unit `max_tokens`.
  - `emptyContext(): ContextSums`: every count 0, `maxTokens` null, `toolResults` `{}`.
  - `contextWeek(week: string, sums: ContextSums): ContextWeek` adds `meanTokens` (`tokens / calls`, null when `calls` is 0) and `readShare`.
- **The `CLAUDE.md` line:** "The weekly context sums (calls, tokens, largest, units over the cap, tool results by class, sweeps) come only from `contextSums` in `packages/server/src/views/context.ts`, the reporter's `context_rows`. A unit counts only with a `context`: a run in its record's week, a session in its start's. A week's mean and read share come only from `contextWeek` there, and a unit's read share only from `readShare` in `packages/shared/src/facts.ts`. `check:real` compares the sums with `totals.context`."

- [ ] **Step 1: Write the failing tests** in `context.test.ts`:
  - **On report-v7,** `contextSums` over its runs and sessions equals `totals.context` week by week: `calls`, `tokens`, `max_tokens`, `units_over_cap`, `tool_results` and `sweeps`.
  - The window-less runs, the "Offline sync build" session and the session with no `start` count nowhere.
  - A `tool_results` class the reporter adds later sums, and counts in `readShare`'s total.
  - `readShare` of all zeros or of null is null.
  - `contextWeek` of `emptyContext()` has `meanTokens` and `readShare` null.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/context.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: contextSums, the weekly context sums over runs and sessions`.

### Task 4: Compliance shows the reporter's information lines

**Wave:** A

**Files:**
- Modify: `packages/shared/src/api/compliance.ts`
- Modify: `packages/server/src/views/compliance.ts`
- Modify: `packages/server/src/routes.ts`, the `/api/compliance` block only
- Modify: `packages/server/test/compliance.test.ts`
- Modify: `packages/web/src/compliance/CompliancePage.tsx`, its stories, and its story fixtures in `src/test/`
- Modify: `packages/web/src/lib/format.ts`: `hiddenInformationLabel` and `informationMark`
- Modify: `packages/web/src/components/ReporterMark.tsx` and its stories
- Modify: `packages/web/e2e/compliance.spec.ts`, and the `compliance.screens.ts` baseline
- Modify: `CLAUDE.md`:
  - the reporter figures line ("A figure that isn't a sum over units …"): its list gains "Compliance's information lines"
  - the `ReporterMark` line: the information lines show `informationMark` through it

**Interfaces:**
- **`ComplianceResponse`** gains `information: { lines: string[]; hidden: number; source: 'reporter' } | null`.
- **`complianceView`'s input** gains `totals: unknown`, read only through `reporterTotals`. `information` is:
  - null when the totals are null or have no `health.info`
  - with no scope, `{ lines: info, hidden: 0, source: 'reporter' }`
  - with a scope, `{ lines: [], hidden: info.length, source: 'reporter' }`
- **The route** passes `totals: lastGoodImport(deps.db)?.totals`, as the Models route does.
- **The mark:** `reporterMark` reads "reporter, all time", but the information lines are the latest export's, counted over this week's transcripts. So `format.ts` gains `informationMark = { text: 'reporter', tooltip: "The latest export's lines, as the reporter writes them; not filtered by period." }`, the mockup's badge, and `ReporterMark` takes an optional `mark` prop, `reporterMark` by default, so its other uses don't change.
- **`hiddenInformationLabel(count: number): string`** gives "3 information lines are hidden while showing" ("1 information line is …"), through `plural`.
- **The page,** below the warning list, only when `information` isn't null:
  - an `h2` "Information from the reporter" with `<ReporterMark mark={informationMark} />`
  - a muted line: "The latest export's information lines, as the reporter writes them: not warnings, and not filtered by period."
  - a `ul` labelled "Information from the reporter", one `li` per line, or `hiddenInformationLabel(hidden)` when `hidden` > 0

- [ ] **Step 1: Write the failing tests.**
  - **In `compliance.test.ts`:**
    - On report-v7, `information` is its `totals.health.info` with `source: 'reporter'`.
    - On report-v6 it is null.
    - With showing on lantern-notes, `lines` is `[]` and `hidden` is 3, and `leaks` finds nothing, `feature/webhooks` included.
  - **Stories:**
    - Full gains three information lines; its play finds the list and the mark reading "reporter".
    - `ReporterMark` gains a story with `informationMark`.
    - A Showing story shows "3 information lines are hidden while showing".
    - The other stories' fixtures carry `information: null`.
  - **The e2e:** Compliance's "Information from the reporter" list holds a line starting `inline sweeps:`, with no axe violations.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/compliance.test.ts packages/web/src/compliance packages/web/src/components/ReporterMark.stories.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** Re-render the Compliance baseline with `pnpm test:screens --update-snapshots --workers=1 e2e/compliance.screens.ts`, and commit it.
- [ ] **Step 4: Run** `pnpm vitest run`, `pnpm typecheck`, the Playwright checks and `pnpm test:screens`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: Compliance shows the reporter's information lines, hidden while showing`.

### Task 5: `contextView` and `GET /api/context`

**Wave:** B

**Files:**
- Modify: `packages/server/src/views/context.ts`: `contextView` and `CONTEXT_CAP`
- Modify: `packages/shared/src/api/context.ts`: `ContextUnit`, `ContextResponse` and `ContextQuery`
- Modify: `packages/server/src/views/runs.ts`, the period functions only (`periodRuns`, `periodUnits` and their new sibling)
- Modify: `packages/server/src/views/sessions.ts`: extract `sessionFacts`
- Modify: `packages/server/src/routes.ts`: a new `/api/context` block after `/api/sessions`
- Modify: `packages/server/test/context.test.ts`
- Modify: `CLAUDE.md`:
  - the `periodUnits` line names `periodStoredUnits`
  - the Sessions page's rows line: a session's title, ID and project name come only from `sessionFacts`, for the Sessions and Context views
  - a new line on the cap

**Interfaces:**
- **`periodStoredUnits(runs, sessions, query, now): { weeks: string[]; runs: StoredUnit<RunEntry>[]; sessions: StoredUnit<SessionEntry>[] }`** in `views/runs.ts` owns the one stored-unit period filter: today's `periodRuns` run filter (`matches(storedFacts(unit, names))`) and `periodUnits`' session filter. `periodRuns` becomes `periodStoredUnits(runs, [], query, now)` and `periodUnits` becomes `periodStoredUnits(runs, sessions, query, now)`, each with its units mapped to `.merged`, so all three share one filter and their callers don't change.
- **`sessionFacts(session: SessionEntry, runRoots: Set<string>, names: Map<string, string>, scope: Scope | null): { title: string | null; sessionId: string | null; projectKey: string | null; project: string | null }`** in `views/sessions.ts`:
  - It holds the row expressions `sessionsView` uses today: the masked title, the ID (null with a scope), `sessionProjectKey`, and the scope's name or the stored name.
  - `sessionsView` uses it, and its tests stay as they are.
- **The types:**
  - `ContextQuery = FindingsQuery & { over: boolean }`
  - `ContextUnit`:
    ```ts
    {
      kind: 'run' | 'session'; key: string;
      run: RunFacts | null;                                    // a run, as storedFacts then showFacts give it
      session: { title: string | null; sessionId: string | null; project: string | null } | null;
      at: string | null;                                       // a run's record.date, a session's start
      calls: number; medianTokens: number | null; maxTokens: number | null;
      callsOverCap: number; overCap: boolean; handoff: string | null;
      handedOffTo: { title: string | null; sessionId: string | null } | null;
      readShare: number | null; sweeps: { inline: number; delegated: number };
    }
    ```
  - `ContextResponse = { weeks: ContextWeek[]; cap: number; uncounted: { runs: number; sessions: number }; units: ContextUnit[]; hidden: number }`
- **`CONTEXT_CAP = 300_000`,** exported from `views/context.ts`.
- **`contextView(input: { runs: StoredUnit<RunEntry>[]; sessions: StoredUnit<SessionEntry>[]; query: ContextQuery; now: Date; scope: Scope | null }): ContextResponse`:**
  - **The units** come from `periodStoredUnits`.
  - **`weeks`:** `contextWeek` of `contextSums` over their merged entries, for each period week, oldest first. A week with no unit gets `emptyContext()`.
  - **`uncounted`:** the period's runs and sessions whose `tool_results` is null or absent.
  - **`units`:** those with a `context`, only those with `over_cap` when `query.over`. They are ordered by `calls_over_cap` (most first), then `max_tokens` (largest first).
    - A run is `showFacts(scope, storedFacts(unit, storedNames(runs)))`, and is left out when that is null.
    - A session is listed only when `showSession(scope, session.project)`. Its `session` comes from `sessionFacts`.
    - Each unit left out counts in `hidden`.
  - **`handedOffTo`** looks up, among all stored sessions, the one whose `key` is `context.handoff_to`. It is null when there is none, or when `showSession` doesn't hold for it. Otherwise it is that session's `title` and `sessionId` from `sessionFacts`.
  - **`cap`** is `CONTEXT_CAP`.
- **The route:** `GET /api/context` builds `{ ...periodQuery(c), over: c.req.query('over') === '1' }` and passes `listUnits` for runs and sessions, `now: deps.now()` and `scope: scopeFor(runs, sessions)`.
- **The cap's `CLAUDE.md` line:** "The context cap the Context page draws is `CONTEXT_CAP` in `views/context.ts`, the app's default until the reporter exports its own (CR14), and the page says so."

- [ ] **Step 1: Write the failing tests** in `context.test.ts`. Import report-v6, then report-v7, into a fresh database.
  - **12 weeks:**
    - 12 weeks, oldest first. The Nov 8 week equals `totals.context`'s Nov 8 row, and the Oct 4 week is empty, with `meanTokens` null.
    - `uncounted` is `{ runs: 3, sessions: 0 }`.
    - With `path: 'full'`, `uncounted` is `{ runs: 2, sessions: 0 }` and no session is listed.
  - **`over: true`:**
    - The units are over the cap only, the offline-sync Full run first.
    - "Offline sync plan"'s `handedOffTo` names "Port lantern-notes' sync to tidepool-api".
    - The webhooks run's `handedOffTo` is null.
  - **`over: false`** adds the units under the cap, and the test asserts the whole order the fixture's values give: calls past the cap, then largest. "Offline sync build" and the session with no `start` are never listed.
  - **Showing on lantern-notes:**
    - The weeks and `uncounted` equal the run with no scope.
    - Only lantern-notes runs and sessions are listed, with no `sessionId`.
    - "Offline sync plan"'s `handedOffTo` is null.
    - With `over: true`, `hidden` is 2: the webhooks run and the tidepool-api session.
    - `leaks` finds nothing.
  - **Report-v6 alone:** every week is empty, `units` is `[]`, and `uncounted` counts every run and dated session of the period.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/context.test.ts`. Expected: FAIL. (`sessions.test.ts` stays as it is and keeps passing through the `sessionFacts` refactor.)
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: the context API: the period's weekly context, its uncounted units and the units behind it`.

### Task 6: A run's page shows its context

**Wave:** B

**Files:**
- Modify: `packages/shared/src/api/runs.ts`: `RunResponse.context`
- Modify: `packages/server/src/views/runs.ts`, `runView` only
- Modify: `packages/server/test/runs.test.ts`
- Modify: `packages/web/src/lib/format.ts`: `formatCompact`, and `formatTokens` through it
- Modify: `packages/web/src/runs/RunPage.tsx`, its stories, and its story fixtures in `src/test/`
- Modify: the `runs.screens.ts` baseline, if a run page in it shows context

**Interfaces:**
- **`RunResponse.context`:** `{ calls: number; medianTokens: number | null; maxTokens: number | null; callsOverCap: number; handoff: string | null; toolCharacters: number; readShare: number | null; sweeps: { inline: number; delegated: number } } | null`.
  - It is null when the run's `context` is null.
  - `toolCharacters` is the sum of every `tool_results` class.
  - `readShare` comes from Task 3's `readShare`, imported from `@cwd/shared`.
- **`formatCompact(value: number | null): string`:** `Intl.NumberFormat('en-US', { notation: 'compact' })` with its default rounding, so 281,449 is "281K" and 1,300,000 is "1.3M", as the spec and mockup write them; `NONE` for null. `formatTokens` stays as it is: its one fraction digit is the Models page's.
- **The Context section,** between Advisor and Warnings, with `Section`'s "None" when `context` is null. Its four items:
  - `${calls} calls · median ${formatCompact(medianTokens)} · largest ${formatCompact(maxTokens)}`
  - `${plural(callsOverCap, 'call')} past the cap · ` then `no handoff`, or `handed off ` with `<Time iso={handoff} />` (`layout/StatusBanner.tsx`)
  - `Tool results: ${formatCompact(toolCharacters)} characters · read ${formatShare(readShare)}`, since `formatShare` rounds to a whole percent
  - `Sweeps: ${inline} inline · ${delegated} delegated`

- [ ] **Step 1: Write the failing tests.**
  - **In `runs.test.ts`,** on report-v7:
    - The offline-sync Full run's `context` holds its facts, with `toolCharacters` the sum of its seven classes.
    - A window-less run's `context` is null.
  - **Stories:**
    - Full's run gains a context with a median of 281,449; its play finds the Context section's four items, "median 281K" and "past the cap" included.
    - A run with `context: null` shows "None" there.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/runs.test.ts packages/web/src/runs`. Expected: FAIL.
- [ ] **Step 3: Implement.** If a run page in `runs.screens.ts` now shows a Context section, re-render that baseline with `pnpm test:screens --update-snapshots --workers=1 e2e/runs.screens.ts` and commit it.
- [ ] **Step 4: Run** `pnpm vitest run`, `pnpm typecheck`, the Playwright checks and `pnpm test:screens`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: a run's page shows its context, tool results and sweeps`.

### Task 7: The Context page

**Wave:** C

**Files:**
- Create: `packages/web/src/context/ContextPage.tsx`, `ContextUnits.tsx` and their stories
- Create: `packages/web/src/test/context.ts`
- Create: `packages/web/src/components/ShareBar.tsx` and `ShareBar.stories.tsx`
- Modify: `packages/web/src/home/SkillsAndCommands.tsx`: its share bar becomes `ShareBar`
- Modify: `packages/web/src/home/WeeklyCharts.tsx`: `singleBars`' options, and `findingsOption`'s body as the exported `barsOption`
- Modify: `packages/web/src/runs/RunsPage.tsx`: `listPath` takes `over`
- Modify: `packages/web/src/router.tsx` and `packages/web/src/layout/Menu.tsx`
- Modify: `packages/web/src/lib/format.ts`: `TOOL_CLASS_LABELS` and `uncountedLabel`
- Create: `packages/web/e2e/context.spec.ts` and `context.screens.ts`, with its baseline
- Modify: `CLAUDE.md`, the share bar line: it names `ShareBar`

**Interfaces:**
- **`singleBars(weeks, name, data, cost = false, options: { cap?: number; format?: (value: number) => string } = {})`:**
  - `format` sets the tooltip's `valueFormatter` and the y axis labels.
  - `cap` adds a dashed `markLine` at that value. It is silent and has no symbol, its line and label use `INK`, its label is `cap ${formatCompact(cap)}`, and the y axis reaches at least the cap.
  - Existing calls don't change.
- **`barsOption(weeks: string[], series: { name: string; data: (number | null)[] }[], stack?: string)`:** `findingsOption`'s body today, exported. Its series take `SERIES` in order, with its legend and surface border, stacked only when `stack` is given. Home's findings chart calls it with `'findings'`, and its output and baseline don't change. The Sweeps chart calls it with no stack, for side-by-side bars.
- **`ShareBar({ share }: { share: number | null })`:** today's markup in `SkillsAndCommands.tsx`, `SHARE_FILL` on `SHARE_TRACK` with `formatShare` beside it, which rounds an unrounded share and changes nothing for Skills' already rounded one.
- **`listPath`'s query** gains `over?: boolean`, which adds `over=1`.
- **`TOOL_CLASS_LABELS`:** `{ read: 'Read', bash_other: 'Bash', run: 'Run', agent: 'Agent', edit: 'Edit', mcp: 'MCP', other: 'Other' }`, in that order, as the mockup's table.
- **`uncountedLabel({ runs, sessions }): string`:** "Not counted: 3 runs and 0 sessions with no context facts.", through `plural`.
- **The route** is `/context`. The menu entry "Context" goes after Sessions.

**The page,** as the mockup draws it:
- **`ListFilters`,** with the query starting at `{ weeks: 12 }`, and the data from `useLiveQuery<ContextResponse>(listPath('/api/context', { ...query, over }))`. `over` starts true.
- **Five `Chart`s,** height 180, in Weeks' grid:
  - "Mean context per call" (`meanTokens`) and "Largest context" (`maxTokens`), each with `{ cap, format: formatCompact }`
  - "Runs and sessions over the cap" (`unitsOverCap`)
  - "Read share of tool results" (`readShare`, `format: formatShare`)
  - "Sweeps" (`barsOption`, inline then delegated, no stack)
- **A muted line under the charts:** "Context is a main call's input plus cache tokens, as the reporter counts it. A week sums its runs, by finish, and its sessions, by start. ", then `uncountedLabel(uncounted)`, then " The dashed line is the context cap, ", `formatCompact(cap)`, ": the app's default until the reporter exports its own."
- **A `<details>`,** "The charts as a table", with a table that scrolls sideways (`containerProps`, labelled "Weekly context"). Newest week first, its columns are:
  - Week, Units, Calls, Mean per call, Largest and Over the cap
  - the seven `TOOL_CLASS_LABELS` classes, `formatCompact`, under a "Tool-result characters" header spanning them, as the mockup draws it
  - Read share, Inline and Delegated
- **"Runs and sessions"** (`ContextUnits`):
  - an `Option` group labelled "Units": "Over the cap" and "All"
  - a table labelled "Runs and sessions" that scrolls sideways. Its columns:
    - the kind as an outline `Badge`
    - the unit: a run as a link to `/runs/$key` reading `runWhere(run)`; a session as `sessionName(title)`, with `SessionChip` when `sessionId` is set and `projectLabel(project)` under it
    - When (`Time`), Calls, Median per call and Largest (`formatCompact`)
    - Past the cap, Handoff (`Time` or `NONE`)
    - Handed off to (`sessionName` with its `SessionChip`, or `NONE`)
    - Read share (`ShareBar`), and Sweeps as `${inline} · ${delegated}`
  - with no units, "No runs or sessions past the cap in this period.", or "No runs or sessions with context in this period." under All
  - `hiddenLabel(hidden, 'row')` when `hidden` > 0

- [ ] **Step 1: Write the failing tests.**
  - **Stories,** on `src/test/context.ts`'s invented responses:
    - Empty: every week empty and no units.
      - The empty line shows, and so does the uncounted line.
      - The table's mean, largest and read share cells read "–", and no text holds "NaN".
    - Full:
      - Five `img`s, and the text "cap 300K".
      - The table's newest row.
      - The list's first row is the unit with the most calls past the cap.
      - Pressing "All" fetches the path without `over=1`.
    - Loading and Error.
    - Showing: no `SessionChip`, and the hidden line.
  - **`ContextUnits` stories:** Empty (the empty line), Full (the rows in the response's order, a run's link, a session's chip and project, a "Handed off to" cell naming its session and one reading "–") and Showing.
  - **`ShareBar` stories:** a null share reads "–", and a share of 52.4 reads "52%".
  - **The e2e (`context.spec.ts`):**
    - Open Context from the menu.
    - Five charts show.
    - The first row is the lantern-notes offline-sync run; follow its link to the run's page, which shows a Context section.
    - Back on Context, "All" adds the units under the cap.
    - No axe violations.
  - **`context.screens.ts`:** the page's main region matches its screenshot.
- [ ] **Step 2: Run** `pnpm vitest run packages/web/src/context packages/web/src/components/ShareBar.stories.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement,** with the `dataviz` skill loaded. Render the page and look at it. Commit the new baseline from `pnpm test:screens --update-snapshots --workers=1 e2e/context.screens.ts`.
- [ ] **Step 4: Run** `pnpm vitest run`, `pnpm typecheck`, the Playwright checks and `pnpm test:screens` (leaving `shell.screens.ts` out). Expected: PASS.
- [ ] **Step 5: Commit:** `feat: the Context page: weekly context, tool results and sweeps, and the runs and sessions behind them`.

### Task 8: check:real compares the weekly context and checks the context route for leaks

**Wave:** C

**Files:**
- Modify: `packages/server/src/check-real.ts`
- Modify: `packages/server/test/check-real.test.ts`
- Modify: `packages/shared/fixtures/report-projects.json`, the leak-check fixture
- Modify: `README.md`: the check:real paragraph

**Interfaces:**
- **A `context` line** comes after the units' line, through `differLine('context', …)`.
  - It compares `contextSums` over every run and session of the export with `totals.context`, week by week:
    - `calls`, `tokens`, `max_tokens` and `units_over_cap` exactly
    - `tool_results` and `sweeps` through `sameCounts`
    - a week in only one of them differs
  - Differing weeks are named, since a week names no project.
  - It prints `context: not in the export` when the totals have no `context`.
- **The showing check** adds `'/api/context?weeks=52'`.
- **`report-projects`** (its showing check shows Archive lantern-notes) gains the spec's leak cases, all invented:
  - the three facts on its two Work lantern-notes runs, which have windows and are hidden, one of them over the cap
  - all three null on its window-less runs
  - `totals.context` agreeing with them
  - `totals.health.info` with a line naming the hidden branch `chore/tidy-imports`

  The handoff to a session in a hidden root stays on report-v7, which this task's showing check also runs, showing lantern-notes: `report-projects`' sessions have no project.
- **The README** adds the weekly context to the compared sums, and the Context page to the showing check's pages.

- [ ] **Step 1: Write the failing tests:**
  - On report-v7, check:real prints `context: 2 compared, 0 differ` and `showing: pass`.
  - On report-projects, it prints `context: 2 compared, 0 differ` and `showing: pass`. The existing exact-output assertions gain the `context` line.
  - With one `totals.context` row's `calls` changed, it prints `context: 2 compared, 1 differ` and that week's date. So it does with one row's `tool_results.read` changed, and with a third week only in `totals.context`.
  - On report-v6, it prints `context: not in the export`.
  - No line contains `/Users/`.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/check-real.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: check:real compares the weekly context with the reporter and checks the context route for leaks`.
