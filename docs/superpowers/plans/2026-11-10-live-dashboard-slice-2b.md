# Live dashboard, slice 2b ("The static page's sections, Compliance and CR10") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five things. The static page's four sections become pages: Weeks, Steps and rules, Skills, and Models and advisor. Compliance groups warnings by kind and week. Home's step boxes turn orange. The Findings page and the run page read the workflow's own labels (CR10).

**Architecture:**
- **Where the facts come from:** the reporter's JSON gains the merged workflow's new keys: PR #8's warning objects and titles, and CR10's labels, strengths and category list. The loader reads the keys, and a new invented fixture holds them.
- **The pages' figures:** each page's figures are pure sums over the stored runs (and sessions for Skills). They live in its view, and `check:real` compares them with the reporter's totals. A figure that isn't a sum over units yet comes from the latest export's totals, marked "reporter, all time".
- **Compliance:** reuses the Findings grid, extracted into one heatmap component, over warning kinds that the warnings table now stores.
- **CR10:** its list replaces the app's, everything gets relabelled once, and the workflow's labels win over the app's.

**Tech Stack:** as slice 2a (Node, TypeScript, Hono, Drizzle over `better-sqlite3`, zod, React, Vite, TanStack Query, Router and Table, Tailwind, shadcn/ui, ECharts, Vitest, Storybook, Playwright, axe, `@anthropic-ai/sdk`).

**Spec:** `docs/superpowers/specs/2026-11-09-live-dashboard-design.md`, specifically:
- the "Slice 2 design" section's 2b part
- decisions 42, 48, 49 and 50
- the slice 2 entries under "Claude's calls"

**Mockups:**
- `docs/design/2026-11-10-slice-2b/compliance.html`
- `docs/design/2026-11-09-slice-2/basics-and-showing.html`: the four tables, which ship working but plain
- `docs/design/2026-11-09-slice-2/findings.html`: the Valid and strengths columns

**The reporter's new keys:**
- PR #8's spec: `~/Work/claude-workflow/docs/superpowers/specs/2026-11-09-dashboard-facts-design.md` on `origin/main`. Section 1 has the warning object shape and its 29 kinds.
- CR10's spec: `2026-11-09-findings-labels-design.md` there. Sections 1, 2, 3 and 6 cover the list, `validity`, `strengths` and schema 5.

Read them with `git -C ~/Work/claude-workflow show origin/main:<path>`. They describe code, not data.

## Global Constraints

- **Read no real data.** Not `~/.claude/workflow-log.jsonl`, not `~/.claude/projects`, not the dashboard's data dir, and not the installed reporter's output. The workflow repo's specs, code and tests may be read. Fixtures are invented, and no test calls the Anthropic API.
- **Every new `report.ts` field follows its convention:** `.nullish()` (a `z.unknown()` one `.optional()`), and only the fields the dashboard reads. An export from the old reporter has none of the new keys, and every page still renders: a missing reporter total shows as `NONE` ("–").
- **A figure summed over stored units** lives in its page's view as an exported pure function of the units. `check:real` compares it with the reporter's matching total (Task 10). Weekly sums go in `weekSums` (the existing convention).
- **A figure taken from the latest export's totals** (`lastGoodImport(db).totals`) carries `source: 'reporter'` in its response, and the page marks it "reporter, all time". These figures, by the spec:
  - dispatch-guard refusals
  - the advisor's whole row and facts, with its weekly table filtered to the period's weeks
  - startup counts
  - each skill's "required but missing"
  - the stage table and the main sessions' "differs"
  - the agents' "mismatches"
- **A period** is `periodQuery` and `period` from 2a: weeks, path and project.
  - A run counts by its finish time.
  - A skill counts when one of its loads (`skills[].time`) falls in the period's weeks.
  - A run's warning counts in its run's week, a session's in the week it was first seen.
- **Showing mode** applies in every new view through `scope.ts`, as 2a's conventions say. Sums count every project. Lists hold only shown projects, masked. Session warnings are left out. Each new view's tests run `leaks`.
- **Every new page:**
  - gets a menu entry, in decision 22's order: Home, Runs, Findings, Compliance, Steps and rules, Skills, Models and advisor, Weeks
  - gets a route, `ListFilters` for its filters, stories (Empty, Full, Loading and Error)
  - gets an axe check in `e2e/<page>.spec.ts` and a screenshot in `e2e/<page>.screens.ts`
- **Charts** (Weeks' small multiples) use ECharts under the chart conventions, with the `dataviz` skill loaded.
- **Headings and labels:** a reporter-sourced figure's mark reads "reporter, all time". The four basics tables reuse the static page's column names. Display text lives in `format.ts`.
- **Failing-test check** after each task, as in 2a: `/usr/bin/python3 -I ~/.claude/scripts/failing-test-check.py --base <task start SHA> --link node_modules --link packages/shared/node_modules --link packages/server/node_modules --link packages/web/node_modules --timeout 240 -- pnpm vitest run <the task's test files>`, with a `--test-file` for each.
- **Commit messages** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **An export from the old reporter.** It has no `warnings` objects, no `categories`, and only `weeks` in its totals. Every page renders, reporter-sourced figures show "–", and warnings stored before CR4 count under "Other". With no category list, the labeller labels nothing and every finding sits in its area's unlabelled row. Pinned in Tasks 1, 6 and 8.
2. **A warning kind the dashboard's family table doesn't know,** or a null `kind`. It lands under "Other", never dropped. Pinned in Task 6.
3. **A schema 5 finding the reporter cleaned to `category: null` or `validity: null`.** It reads as not labelled by the workflow, and the app's label shows, marked as the app's. Pinned in Task 9.
4. **Showing mode on every new route.** Warning texts hold branches and session files, and agent and skill names are safe. Each new route's response holds no hidden project's name, path or branch and no session ID. Pinned in each page task through `leaks`, and on real data in Task 10.
5. **The switch to CR10's list relabels every stored finding.** The daily cap still holds, and a finding waiting for its new label sits in its area's unlabelled row, never in a row of the old list. Pinned in Task 8.

---

### Task 1: The reporter's new keys, and a schema 5 fixture

**Files:**
- Modify: `packages/shared/src/report.ts`
- Create: `packages/shared/fixtures/report-v5.json`
- Modify: `packages/shared/test/load.test.ts`
- Modify: `packages/server/src/dev-fixtures.ts` (default fixtures `report-full report-later report-v5`)
- Modify: `packages/web/src/lib/format.ts` (`reporterMark`)
- Modify: `packages/web/src/lib/format.test.ts`
- Modify: `packages/web/e2e/*.spec.ts`, where a count changes with the third import
- Modify: `packages/web/e2e/*.screens.ts-snapshots/*`, re-rendered by `pnpm test:screens`

**Interfaces** (all in `report.ts`):
- `WarningSchema`: `{ text: z.string(), kind: str, step: z.object({ step: str }).nullish() }`, the fields 2b reads, with `type Warning`.
- `FindingSchema` gains `category: str` and `validity: z.enum(RELEVANCE).nullish()`. `RELEVANCE` comes from `categories.ts`.
- `StepSchema` gains `strengths: z.array(z.object({ category: str, summary: str })).nullish()`.
- `RunRecordSchema` gains `failing_test: z.array(z.object({ task: num, result: str })).nullish()`.
- `RunEntrySchema` gains `offers: z.array(z.object({ skill: str, outcome: str })).nullish()` and `warnings: z.array(WarningSchema).nullish()`.
- `SessionEntrySchema` gains `warnings: z.array(WarningSchema).nullish()`.
- `CategoryListSchema`: `{ version: num, rule: str, validity: z.record(z.string(), z.string()).nullish(), areas: z.array(z.object({ area: str, list: z.array(z.object({ id: z.string(), label: str, means: str })).nullish() })).nullish() }`, with `type CategoryList`. The export's `areas` already include cleanup, with the implementation list. `ReportSchema` gains `categories: CategoryListSchema.nullish()`.
- `reporterMark` in `format.ts` gives the "reporter, all time" badge's text and tooltip: "The latest export's figure over everything the reporter reads; it isn't summed by period yet." Tasks 3–5 use it.
- `TotalsSchema` gains:
  - `scoreboard`: a record keyed by step kind, with `{ ran, found, counts, outcomes, tokens, cost }`, plus `failing_test`, `dispatch_guard`, `advisor: { calls, notes, changed, cost, share }`, `startup: { with, without }`, `fix_round_cap: { runs, ruled }` and `stop_rule: { stops }`
  - `run_time: { with_waves, without_waves }`, each `{ runs, timed, median_minutes }`
  - `skills`: a record keyed by skill, with `{ runs, last, missing }`
  - `models: { agents: record → { requested, actual, mismatches }, main: record → { recommended: record → str, actual, differs } }`
  - `advisor: { calls, tokens, cost, by_role: record → { calls, flagged }, failed, notes, changed, missing, weeks: [{ week, advisor, fable, share, stop }], trial }`
  - `offers`: a record of counts

  Every leaf is nullish. For their exact shapes, read the reporter's `scoreboard`, `run_time`, `skill_totals`, `model_totals`, `advisor_facts` and `offer_totals` on `origin/main`.

**The fixture `report-v5.json`** is report-later's units plus the merged reporter's keys, all invented:
- every run and session gets its `warnings` objects (one per `warns` line, same order and text)
- a new schema 5 Full run in `/Users/example/Work/tidepool-api` (branch `feature/webhooks`, finishing 2026-11-12T08:00:00Z) with:
  - labelled findings in each area: one with `category` and `validity`, one cleaned to nulls
  - `strengths` on two review steps
  - two warnings: one of kind `step_agent_missing` naming `final_review`, and one of a kind no family holds, `brand_new_check`
- a top-level `categories`: CR10's version 1 list with its ids, labels and means, its rule and the validity definitions, copied from CR10's spec section 1
- `totals`: every key above, filled so that the sums Tasks 2–5 compute over its runs and sessions agree with it, by the reporter's rules, whose sources are named above. The weeks follow the existing fixture convention.

- [ ] **Step 1: Write the failing tests** in `load.test.ts`:
  - `report-v5` loads, and its new fields parse: a warning's `kind` and `step.step`, a finding's `validity`, a step's `strengths`, `categories.areas[0].list[0].id === 'scope'`, and `totals.scoreboard.task_review.ran`.
  - In `format.test.ts`: `reporterMark` gives its text and tooltip.
- [ ] **Step 2: Run** `pnpm vitest run packages/shared/test/load.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Change dev:fixtures' default list. Run `pnpm --filter @cwd/web exec playwright test --project=checks`, update only the assertions the third import changes, then run `pnpm test:screens --update-snapshots` and commit the baselines.
- [ ] **Step 4: Run** `pnpm vitest run`, `pnpm typecheck`, the Playwright checks and `pnpm test:screens`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: the loader reads the merged reporter's warnings, titles, labels, strengths, category list and totals`.

### Task 2: Weeks

**Wave:** A

**Files:**
- Modify: `packages/server/src/views/home.ts` (`weekSums` gains fields)
- Create: `packages/server/src/views/weeks.ts`
- Create: `packages/shared/src/api/weeks.ts`
- Modify: `packages/shared/src/index.ts` (one line)
- Modify: `packages/server/src/routes.ts` (a weeks block)
- Create: `packages/server/test/weeks.test.ts`
- Create: `packages/web/src/weeks/WeeksPage.tsx` with its `.stories.tsx`
- Modify: `packages/web/src/home/WeeklyCharts.tsx` (exports `Chart` and `singleBars`)
- Create: `packages/web/src/test/weeks.ts`
- Modify: `router.tsx` (one route)
- Modify: `Menu.tsx` (one entry)
- Create: `packages/web/e2e/weeks.spec.ts`
- Create: `packages/web/e2e/weeks.screens.ts` with its baseline

**Interfaces:**
- `WeekSum` gains `tasks`, `findings: { critical, important, minor, unneeded }` (from `final_findings`), `fixRounds`, `stops`, `fablePoints` and `allPoints` (each null when no run has it), `minutesPerRun` (the median of the known `minutes`, null when none is known), and `laterFixes`.
- `runTime(runs: RunEntry[]): Record<'withWaves' | 'withoutWaves', { runs: number; timed: number; medianMinutes: number | null }>`, in `weeks.ts`, over Full runs.
- `WeeksResponse = { weeks: (WeekSum & { week: string })[]; runTime: ReturnType<typeof runTime>; coverageFrom: string | null }`, with the weeks newest first.
- `weeksView(input: { runs: StoredUnit<RunEntry>[]; query: FindingsQuery; now: Date }): WeeksResponse`.
- Route: `GET /api/weeks`, through `periodQuery`.

The page:
- four small multiples (runs, final-review findings, cost, minutes per run), one measure each on its own axis, each a `<Chart option={singleBars(...)} />` reused from Home's `WeeklyCharts.tsx`. The week table below them is their table view.
- the week table with the static page's columns
- the Full runs table, with and without waves

- [ ] **Step 1: Write the failing tests.**
  - In `weeks.test.ts`, on report-v5: each week's new fields match the fixture's `totals.weeks` row, and `runTime` matches `totals.run_time`. With showing on, `leaks` finds nothing (the page has no project text).
  - Stories with interaction tests.
  - The e2e axe check.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/weeks.test.ts packages/web/src/weeks`. Expected: FAIL.
- [ ] **Step 3: Implement,** with the `dataviz` skill loaded for the charts.
- [ ] **Step 4: Run** `pnpm vitest run`, `pnpm typecheck`, the Playwright checks and `pnpm test:screens`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: the Weeks page: the weekly table, four small multiples and Full run time`.

### Task 3: Steps and rules

**Wave:** A

**Files:**
- Create: `packages/server/src/views/steps.ts`
- Create: `packages/shared/src/api/steps.ts`
- Modify: `packages/shared/src/index.ts` (one line)
- Modify: `routes.ts` (a steps block)
- Create: `packages/server/test/steps.test.ts`
- Create: `packages/web/src/steps/StepsPage.tsx` with its stories
- Create: `packages/web/src/test/steps.ts`
- Modify: `router.tsx` (one route)
- Modify: `Menu.tsx` (one entry)
- Create: `e2e/steps.spec.ts`
- Create: `e2e/steps.screens.ts` with its baseline

**Interfaces:**
- `stepSums(runs: RunEntry[]): StepRow[]`, where `StepRow = { step: StepKind; ran: number; found: number; counts: Record<string, number>; fixedOrApplied: number; declined: number; deferred: number; openOrToOwner: number; tokens: Record<string, number> | null; cost: number | null }`. Its rules are the reporter's `scoreboard`:
  - each logged step adds to its kind
  - a schema 1 run adds its final review from `final_findings`, and its simplify when `simplify.ran` is `agents` or `inline`
  - tokens and cost come from `dispatches` of that kind with `models`
  - simplify's tokens and cost are null
- `ruleSums(runs: RunEntry[]): { failingTest: Record<string, number>; fixRoundCap: { runs: number; ruled: number }; stopRule: number; offers: Record<string, Record<string, number> & { offered: number }> }`.
- `StepsResponse = { steps: StepRow[]; rules: { failingTest; fixRoundCap; stopRule; offers }; reporter: { dispatchGuard: Record<string, number> | null; advisor: { calls; notes; changed; cost; share } | null; startup: { with: number; without: number } | null } }`.
- `stepsView({ runs, totals, query, now })`, and the route `GET /api/steps`.
- The reporter's figures carry `reporterMark` (Task 1).

- [ ] **Step 1: Write the failing tests.**
  - In `steps.test.ts`, on report-v5 with a 52-week period and with all runs summed:
    - `stepSums` equals `totals.scoreboard` per kind, cost to the cent.
    - `ruleSums` equals the scoreboard's `failing_test`, `fix_round_cap` and `stop_rule`, and `totals.offers`.
    - `reporter` holds the totals' figures, and they are null on `report-full`.
    - `leaks` finds nothing with showing on.
  - Stories, including one where reporter is null.
  - The e2e axe check.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/steps.test.ts packages/web/src/steps`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full checks, as in Task 2. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: the Steps and rules page: each step and rule over the period, the reporter's all-time rules marked`.

### Task 4: Skills

**Wave:** A

**Files:**
- Create: `packages/server/src/views/skills.ts`
- Create: `packages/shared/src/api/skills.ts`
- Modify: `index.ts` (one line)
- Modify: `routes.ts` (a skills block)
- Create: `packages/server/test/skills.test.ts`
- Create: `packages/web/src/skills/SkillsPage.tsx` with its stories
- Create: `packages/web/src/test/skills.ts`
- Modify: `router.tsx` (one route)
- Modify: `Menu.tsx` (one entry)
- Create: `e2e/skills.spec.ts`
- Create: `e2e/skills.screens.ts` with its baseline

**Interfaces:**
- `skillSums(units: { skills?: RunEntry['skills'] }[]): SkillRow[]`, the same shape as the reporter's `skill_totals(units)`. Here `SkillRow = { name: string; runs: number; last: string | null; outcomes: Record<string, number> }`:
  - `runs` counts the units, runs and sessions alike, that loaded the skill, which is the static page's "runs" column.
  - `last` is the latest load.
  - `outcomes` counts the loads by `skillOutcomeLabel`.
- `SkillsResponse = { skills: (SkillRow & { missing: number | null })[] }`, where `missing` is the reporter's all-time `totals.skills[name].missing`.
- `skillsView({ runs, sessions, totals, query, now })`:
  - It keeps each unit's loads whose `weekOf(parseTime(time))` is in `period(query, now).weeks`, then calls `skillSums`.
  - The path and project filters apply to runs only.
  - The route is `GET /api/skills`, which reads `listUnits(db, 'session')` too.

- [ ] **Step 1: Write the failing tests.**
  - In `skills.test.ts`, with `skillSums` over every stored run and session from report-v5: each skill's `runs` equals `totals.skills[name].runs`, and `last` equals its `last`.
  - A load outside the period doesn't count.
  - `leaks` finds nothing with showing on.
  - Stories and the e2e axe check.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/skills.test.ts packages/web/src/skills`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full checks. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: the Skills page: loads by skill in runs and sessions over the period`.

### Task 5: Models and advisor

**Wave:** B

**Files:**
- Create: `packages/server/src/views/models.ts`
- Create: `packages/shared/src/api/models.ts`
- Modify: `index.ts` (one line)
- Modify: `routes.ts` (a models block)
- Create: `packages/server/test/models.test.ts`
- Create: `packages/web/src/models/ModelsPage.tsx` with its stories
- Create: `packages/web/src/test/models.ts`
- Modify: `router.tsx` (one route)
- Modify: `Menu.tsx` (one entry)
- Create: `e2e/models.spec.ts`
- Create: `e2e/models.screens.ts` with its baseline

**Interfaces:**
- `modelSums(runs: RunEntry[]): { agents: Record<string, { requested: Record<string, number>; actual: Record<string, number> }>; main: Record<Path, Record<string, number>> }`, by the reporter's `model_totals`:
  - a dispatch's agent is `agent ?? 'general-purpose'`
  - a pair is `${model ?? '-'}/${effort ?? '-'}`
  - the main sessions' rows come from `main` by the record's path
- `ModelsResponse = { agents: { name; requested; actual; mismatches: number | null }[]; main: { path; recommended: Record<string, string | null> | null; actual; differs: number | null }[]; advisor: { facts: (the totals' advisor facts) | null; weeks: { week; advisor; fable; share; stop }[] } }`. Mismatches, recommended and differs come from the reporter. The advisor's weeks are the totals' rows within the period's weeks.
- `modelsView({ runs, totals, query, now })`, and the route `GET /api/models`.

- [ ] **Step 1: Write the failing tests.**
  - In `models.test.ts`, summed over all runs: `modelSums` equals the requested and actual counts in `totals.models`.
  - The advisor's weeks are filtered to the period.
  - `leaks` finds nothing with showing on.
  - Stories and the e2e axe check.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/models.test.ts packages/web/src/models`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full checks. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: the Models and advisor page: requested and actual models by agent and path, the advisor's facts`.

### Task 6: Compliance's data, and the diagram's warnings

**Wave:** B

**Files:**
- Modify: `packages/server/src/db/schema.ts` (the `warnings` table gains `kind` and `step`)
- Create: the generated migration
- Modify: `packages/server/src/db/import.ts` (`applyVersion` writes them)
- Modify: `packages/server/src/db/read.ts` (`StoredWarning` gains them)
- Create: `packages/shared/src/api/compliance.ts`
- Modify: `index.ts` (one line)
- Create: `packages/server/src/views/compliance.ts`
- Modify: `packages/server/src/views/home.ts` (the diagram's `warnings`)
- Modify: `routes.ts` (a compliance block, and home's `warnings` input)
- Modify: `packages/server/src/main.ts` (`rebuildDerived` after `openDb`)
- Create: `packages/server/test/compliance.test.ts`
- Modify: `packages/server/test/home.test.ts`
- Modify: `packages/server/test/import.test.ts`

**Interfaces:**
- `warnings` gains the derived columns `warning_kind` and `step_kind` (text, nullable; the warning's `kind` and `step.step`). `StoredWarning` gains them as `warningKind` and `stepKind`, since its `kind` already says run or session.
  - `applyVersion` writes them from the version's `warnings` object whose `text` equals the warns line, and null when there is none. `rebuildDerived` gives the same rows.
  - `main.ts` calls the existing `rebuildDerived(db)` right after `openDb`, so rows stored before this task gain their kinds. A rebuild always gives the same rows (the convention), so rebuilding at every start is safe.
- `FAMILIES: { family: string; kinds: readonly string[] }[]` in `packages/server/src/views/compliance.ts` has five families: `review_flow`, `steps_record`, `agents_models`, `skills_offers`, `sessions`. Their kinds come from PR #8's table, plus CR10's `findings_unlabelled` and `strengths_unrecorded` under `steps_record`. `familyOf(kind: string | null): string` gives `'other'` for an unknown or null kind.
- `ComplianceQuery = FindingsQuery & { resolved: boolean; step?: StepKind }`.
- `ComplianceResponse = { weeks: string[]; rows: { family: string; kind: string | null; cells: number[] }[]; warnings: { kind: string | null; family: string; week: string; text: string; sessionId: string | null; runKey: string | null; project: string | null; branch: string | null; step: StepKind | null; isNew: boolean }[]; hidden: number }`.
  - Rows only for kinds with a warning in the period, in `FAMILIES` order, with "other" last.
  - `kind` is null in the "other" row for warnings stored with no kind.
- `complianceView({ runs, sessions, warnings, query, now, seenAt, scope })`:
  - **Current** warnings are `currentWarnings` for runs, plus the sessions' current warnings. **Resolved** warnings add every other stored warning.
  - **Weeks:** a run's warning counts in its run's week, a session's in the week it was first seen.
  - **Texts** come out as `runView` gives them, or masked through `showWarning` with a scope. A scope also leaves out session warnings and counts the hidden runs' warnings in `hidden`.
  - **`step`** filters to warnings naming that step.
- `homeView`'s `DiagramStep.warnings` counts the current warnings whose `step` is the box's kind: run warnings of the diagram's runs, and session warnings first seen in its 7 days, the latter left out with a scope.
- Route: `GET /api/compliance`, through `periodQuery`, plus `resolved=1` and `step`.

- [ ] **Step 1: Write the failing tests.**
  - In `import.test.ts`: importing report-v5 stores each warning's `warningKind` and `stepKind`, a report-full warning stores nulls, and `rebuildDerived` gives the same rows.
  - In `compliance.test.ts`, on report-full then report-v5:
    - `step_agent_missing` sits in the steps family, in its run's week.
    - `brand_new_check` and every pre-CR4 warning sit under "other".
    - `resolved` adds a warning that report-v5 no longer reports.
    - `step=final_review` filters.
    - `isNew` follows `seenAt`.
    - `leaks` finds nothing with showing on, and no session warning is listed.
  - In `home.test.ts`: the final review box's `warnings` is 1.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/compliance.test.ts packages/server/test/home.test.ts packages/server/test/import.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Generate the migration with `pnpm --filter @cwd/server db:generate` (two `ADD COLUMN`s), and commit it unedited.
- [ ] **Step 4: Run** `pnpm vitest run packages/server` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: warnings keep their kind and step; Compliance by kind and week; the diagram counts warnings by step`.

Conventions lines for the report:
- A warning's kind and step are derived by `applyVersion`, and the family table is `FAMILIES` in `views/compliance.ts`.
- `main.ts` rebuilds the derived values at every start.

### Task 7: The Compliance page, the heatmap component and the orange boxes

**Files:**
- Create: `packages/web/src/components/HeatmapTable.tsx` with its stories
- Modify: `packages/web/src/findings/FindingsGrid.tsx` (renders through `HeatmapTable`)
- Create: `packages/web/src/compliance/CompliancePage.tsx` with its stories
- Create: `packages/web/src/test/compliance.ts`
- Modify: `packages/web/src/home/WorkflowDiagram.tsx` and its stories
- Modify: `packages/web/src/test/home.ts`
- Modify: `router.tsx` (`/compliance`, with a `step` search param)
- Modify: `Menu.tsx` (Compliance, after Findings)
- Modify: `format.ts` (`kindLabel`, `FAMILY_LABELS`)
- Create: `e2e/compliance.spec.ts`
- Create: `e2e/compliance.screens.ts` with its baseline
- Modify: the home screens baseline

**Interfaces:**
- `HeatmapTable({ label, weeks, groups, max, selected, onSelect })`, where `groups: { heading: ReactNode | null; rows: { key: string; header: ReactNode; values: (number | null)[] }[] }[]`.
  - Cells are buttons shaded with `cellShade`, with their numbers written in them.
  - A group with a heading gets a full-width heading row.
  - The table scrolls in `containerProps`' named region.

  `FindingsGrid` keeps its props and renders through it, so its stories and the Findings e2e pass unchanged.
- `kindLabel(kind: string | null): string`: the kind's slug in words, `step_agent_missing` → "step has no agent id" as PR #8's table words it, and "other" for null.
- `FAMILY_LABELS: Record<string, string>` in `format.ts`: Review flow, Steps and the record, Agents and models, Skills and offers, Sessions, Other.
- **The page:**
  - `ListFilters` with a current/resolved switch (the 2a switch convention).
  - The grid by family.
  - A selected cell lists its warnings below: kind, the run's name linking to the run, "new" marks, and the text through `WarningText`.
  - With `step` in the URL, a dismissible "Step: <label>" chip.
- **`WorkflowDiagram`:** a box with `warnings > 0` gets a 2px orange border (the reserved status orange, with its text), "N warnings" written in it, and a link to `/compliance?step=<kind>`.

- [ ] **Step 1: Write the failing tests.**
  - Stories:
    - `HeatmapTable`: Empty and Full.
    - `CompliancePage`: Empty, Full, Loading and Error.
    - The diagram: a `WithWarnings` story that asserts the orange box's text and link.
  - `e2e/compliance.spec.ts`:
    - Open Compliance from the menu.
    - Select the `step_agent_missing` cell: its warning lists with a run link.
    - Open Compliance from Home's orange box, which filters to the final review.
    - axe finds no violations.
- [ ] **Step 2: Run** `pnpm vitest run packages/web/src/components packages/web/src/compliance packages/web/src/home packages/web/src/findings`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full checks, and re-render the home and compliance baselines. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: the Compliance page by kind and week, one heatmap component for it and Findings, orange step boxes`.

### Task 8: CR10's category list replaces the app's

**Files:**
- Modify: `packages/server/src/db/schema.ts` (`imports` gains `categories`, nullable JSON)
- Create: the generated migration (one `ADD COLUMN`)
- Modify: `packages/server/src/db/import.ts` (stores the export's `categories`)
- Modify: `packages/server/src/db/read.ts` (`lastGoodImport` returns `categories`)
- Create: `packages/server/src/categories.ts`
- Modify: `packages/server/src/db/labels.ts` (the list's number in place of `CATEGORY_LIST_VERSION`)
- Modify: `packages/server/src/labeller.ts` (the list, rule and validity definitions in its prompt and checks)
- Modify: `packages/server/src/main.ts` (the label job reads the active list)
- Modify: `packages/shared/src/api/findings.ts` and `api/runs.ts` (`categoryLabels`)
- Modify: `packages/server/src/views/findings.ts` and `views/runs.ts` (rows in the active list's order, labels in responses)
- Modify: `packages/shared/src/categories.ts` (keeps `AREAS`, `areaOf` and `RELEVANCE`; `CATEGORIES` and `CATEGORY_LIST_VERSION` go)
- Modify: `packages/web/src/lib/format.ts` (`categoryLabel(category, labels)`; `CATEGORY_LABELS` goes)
- Modify: `FindingsTable.tsx`, `FindingsGrid.tsx` and their stories
- Modify: `packages/server/src/dev-fixtures.ts` (saves `labels.json` under the active list)
- Modify: `packages/shared/fixtures/labels.json` (CR10's ids)
- Modify: `packages/server/test/labels.test.ts`, `labeller.test.ts` and `findings.test.ts`, moving their labelled cases to report-v5 and CR10's ids

**Interfaces:**
- `type ActiveList = { number: number; areas: Record<Area, { id: string; label: string; means: string }[]>; rule: string; validity: Record<string, string> }`.
- `activeList(db: Db): ActiveList | null`:
  - It is built from the latest good import's `categories`, whose `areas` already map each area to its list.
  - `number` is `100 + version`, so it never meets 2a's labels (list 1), which keep their row and simply stop showing. The `list_version` column keeps its type and primary key, so no stored label moves.
  - It is null when the export has no category list. Then nothing is labelled, every finding sits in its area's unlabelled row, and `categoryLabels` is `{}`.
- `labelInputs` gives each input its area as today. `currentLabels(db, inputs, list)`, `pendingInputs(db, inputs, model, list)` and `saveBatch(db, labels, usage, list)` take the list's number.
- `labelPending(db, client, settings, now, list)`:
  - It keeps a result only when its category is one of `list.areas[area]`'s ids.
  - `anthropicLabelClient`'s schema and prompt are built from the list. The prompt's category lines become `id: means`, it adds the rule, and relevance is defined by the list's `validity` definitions when present.
- `FindingsResponse` and `RunResponse` gain `categoryLabels: Record<string, string>`, and `categoryLabel(category, labels)` uses it. `FindingsView`'s rows follow `activeList`'s order.

- [ ] **Step 1: Write the failing tests.**
  - `labels.test.ts`:
    - After importing report-v5, `activeList.number` is 101, with `code_facts` in its plan list. On report-full alone, it is null.
    - A label saved under list 1 no longer shows once list 101 is active, and its finding sits in the unlabelled row and is pending.
  - `labeller.test.ts`: a stubbed reply naming `task split and order` under list 101 is not stored, and `task_split` is.
  - `findings.test.ts`: the plan rows are the six workflow ids in order, and `categoryLabels.task_split` is "Task split and order".
  - The `FindingsTable` stories show the label from `categoryLabels`.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/labels.test.ts packages/server/test/labeller.test.ts packages/server/test/findings.test.ts packages/web/src/runs packages/web/src/findings`. Expected: FAIL.
- [ ] **Step 3: Implement.** Generate the migration. Read its SQL, and check that it is a single `ALTER TABLE imports ADD COLUMN` that keeps every stored row.
- [ ] **Step 4: Run** `pnpm vitest run` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: the workflow's category list replaces the app's; every finding is relabelled once under it`.

Conventions lines for the report:
- The active list comes only from `activeList` in `packages/server/src/categories.ts`.
- A label's `list_version` is 1 for the app's built-in list and 100 + N for the workflow's version N.
- Responses carry `categoryLabels` for display.

### Task 9: The workflow's labels win; Valid, strengths and "app differs"

**Files:**
- Modify: `packages/shared/src/api/runs.ts` (`FindingRow`, `RunResponse.strengths`)
- Modify: `packages/shared/src/api/findings.ts` (`FindingCell`, the measures)
- Modify: `packages/server/src/views/runs.ts` (`runView`)
- Modify: `packages/server/src/views/findings.ts`
- Modify: `packages/server/test/runs.test.ts` and `findings.test.ts`
- Modify: `packages/web/src/runs/FindingsTable.tsx`, `RunPage.tsx`, the Findings page and grid, and their stories
- Modify: `packages/web/src/test/runs.ts` and `test/findings.ts`
- Modify: `packages/web/e2e/findings.spec.ts` and `runs.spec.ts`

**Interfaces:**
- `FindingRow` gains `validity: Relevance | null` (the workflow's call), `judge: 'workflow' | 'app' | null` (whose category shows), and `appCategory: string | null` and `appRelevance: Relevance | null` (the app's label, set only where it differs from the workflow's category or validity).
  - **`category`:** the workflow's category when the finding carries one, else the app's.
  - **`relevance` and `labelReason`:** the app's call and reason, as in 2a.
- `RunResponse` gains `strengths: { step: StepKind; task: number | null; round: number | null; category: string | null; summary: string | null }[]`, with each summary masked with a scope.
- `FindingCell` gains `strengths`, `byApp` (findings whose shown label is the app's) and `appDiffers` (findings the app labels differently).
  - `invalid` counts the workflow's `validity` when set, else the app's relevance.
  - A strength counts in its step's area row under its category, in its run's week.
- `Measure` gains `'appDiffers'` and `'strengths'`, both enabled.
- When some of a cell's count is the app's, the cell shows "N · M by the app".
- The page line "every label is the app's" shows only while no finding in the period has `judge: 'workflow'`.
- **`FindingsTable`:**
  - Valid shows `validity`.
  - App shows "agrees", or `appCategory` / `appRelevance` where they differ.
  - The dashed "app" badge is only on `judge: 'app'` categories.
- **The run page:** a "Strengths" list under the findings table.

- [ ] **Step 1: Write the failing tests.**
  - In `runs.test.ts`, on report-v5's schema 5 run with an app label saved that differs:
    - its labelled finding has `judge: 'workflow'`, its category and validity, and `appCategory` set
    - the finding cleaned to nulls has `judge: 'app'`
    - `strengths` lists two entries
    - with showing on, `leaks` finds nothing
  - In `findings.test.ts`: `strengths`, `byApp` and `appDiffers` in the run's week and category.
  - Stories:
    - `FindingsTable`: `WorkflowLabels`.
    - The Findings page: the `appDiffers` and `strengths` measures.
  - e2e: the run page lists the strengths, and the Findings page's "App differs" is enabled.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/runs.test.ts packages/server/test/findings.test.ts packages/web/src/runs packages/web/src/findings`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full checks, re-rendering the findings and run baselines. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: the workflow's labels win over the app's; Valid, strengths and app differs`.

Conventions line for the report: the CR10 entry in `CLAUDE.md` changes from "titled 'The app's label' while every label is the app's" to "only on the app's labels (`judge: 'app'`)".

### Task 10: check:real compares the new sums and checks the new routes for leaks

**Files:**
- Modify: `packages/server/src/check-real.ts`
- Modify: `packages/server/test/check-real.test.ts`
- Modify: `README.md` (the "Checking your real data" lines)

**Interfaces:**
- Consumes `weekSums`, `runTime`, `stepSums`, `ruleSums`, `skillSums` (with `from` null) and `modelSums`, over the export's runs and sessions.

**`check:real` gains these lines:**
- `weeks:` now compares every `WeekSum` field with `totals.weeks`, cost to the cent.
- `run time: compared, <n> differ`, against `totals.run_time`.
- `steps: <k> compared, <n> differ`, against `totals.scoreboard`'s kinds.
- `rules: <n> differ`, for `failing_test`, `fix_round_cap`, `stop_rule` and `offers`.
- `skills: <k> compared, <n> differ`, comparing runs plus sessions with `runs`, and `last`.
- `models: <n> differ`, for the requested and actual counts.

Each line names only the differing keys' names: a step kind, a skill or agent name, a rule, never a value. The showing check's request list adds `/api/weeks`, `/api/steps`, `/api/skills`, `/api/models` and `/api/compliance?resolved=1`, all with `weeks=52`.

- [ ] **Step 1: Write the failing test.** On report-v5 with `cat` as the reporter, check:real prints `steps: 7 compared, 0 differ`, the other new lines at 0, and `showing: pass`, with no line containing `/Users/`.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/check-real.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: check:real compares the new pages' sums with the reporter's totals and checks their routes for leaks`.
