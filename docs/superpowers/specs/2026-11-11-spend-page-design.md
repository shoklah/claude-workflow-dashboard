# The Spend page: design

Date: 2026-11-11. Status: approved by the owner on 2026-11-11. Path: Full (the import's schema, a new page, view and route, showing mode, `check:real`, fixtures). Issue: [#11](https://github.com/shoklah/claude-workflow-dashboard/issues/11). Builds on the live dashboard design (`2026-11-09-live-dashboard-design.md`, decisions 18, 20, 44 and 52, and "Totals are sums over units") and on the reporter's CR13, spend by phase. Mockup: `docs/design/2026-11-11-spend/spend.html`, approved by the owner on 2026-11-11 and updated the same day with the decisions under "Decided with the owner".

## Intent

The reporter now splits every run's and session's spend by workflow phase. The owner wants to see where the money goes: what planning costs against implementing, reviewing and coordinating, week over week, and how much spend falls outside any workflow step.

The page describes spend; it doesn't judge it (decision 44). Two other questions were considered and set aside for later: where Fable goes (a phase-by-model grid), and whether review spend is worth it (cost against findings).

## What the reporter exports

Checked on the owner's real export on 2026-11-11, counts and field names only.

- Each run and each session carries `phases`: a list, in the reporter's fixed order, of one entry per phase that counted a message.
- An entry is `{name, models, advisor}`:
  - `name` is one of the reporter's twelve: `design`, `plan_writing`, `plan_simplify`, `plan_review`, `implement`, `task_review`, `fix_check`, `simplify`, `final_review`, `final_fix_check`, `coordination`, `unattributed`.
  - `models` has the unit's `models` shape: per model, `input`, `output`, `cache_read`, `cache_write` and `cost` (null for a model the reporter has no price for), plus `cost_by_kind`, which the page doesn't read.
  - `advisor` is `{calls, cost}`.
- A unit's phases add up to its `models`: on all 196 units with phases (69 of 76 runs, 127 of 131 sessions), the phases' summed cost equals the unit's `models` cost.
- `phases` is null where the reporter couldn't read the spend (4 runs), and an empty list on a unit with no counted message (3 runs, 4 sessions).
- `unattributed` is mostly session spend: it appears in 102 sessions and 1 run.
- The export has no all-time total by phase.

## Goals

- A Spend page showing estimated cost by phase group per week, and by phase and model over the period.
- Unattributed spend shown as its own group, with a line saying what it is.
- A switch between all units, runs only and sessions only.
- The page's sums agree with the reporter: each unit's phases add up to its `models`, checked on real data.

## Non-goals

- The phase-by-model grid and cost against findings (above).
- Spend by phase on the run page or the Sessions page.
- A per-run or per-session list on this page.
- Tokens, as a measure or split by kind: the page is cost only.
- Tiles of headline figures.

## Anti-goals

- The app's five groups pass for the reporter's facts.
- A hidden project's name, path, branch or session ID reaches the page in showing mode.
- The page's totals disagree with Models' or Weeks' cost for the same units without saying why.

## Constraints

- The reporter is the only parser: the page reads `phases` as exported and never derives a phase.
- Costs are the reporter's list-price estimates; the app keeps no price table.
- Fixtures are invented, and a fixture's phases add up to its unit's `models`.

## Approaches

| Question | Considered | Picked |
|---|---|---|
| What the page leads with | where the money goes; where Fable goes; whether review spend is worth it | where the money goes: the plain reading of the data, and the other two can build on it |
| Where it lives | its own menu entry; a section on Models and advisor | its own entry, "Spend": Models and advisor is already the longest page and waits for the UX/UI slice |
| Twelve phases in one chart | five groups in the chart and twelve rows in the table; all twelve stacked; one small chart per phase | five groups: twelve colours don't read, and small multiples lose the total and the shares |

## Design

### 1. Import and storage

- `phases` joins the run's and the session's schema in `packages/shared/src/report.ts`, `.nullish()`, reading `name`, each model's `cost`, and the advisor's `calls` and `cost`. The token counts and `cost_by_kind` are left out, since the page doesn't read them.
- A phase name the app doesn't know is kept as a string, not rejected, so a new phase in the reporter doesn't fail an import.
- No migration: units' raw JSON is already stored whole, and nothing derived is added.
- Across a unit's versions, a non-null `phases` replaces the stored one whole, and a null never replaces a known value, as for the reporter's other per-version values.

### 2. The sums: `phaseSums`

One function, `phaseSums` in `packages/server/src/views/spend.ts`, is the only place spend by phase is summed.

- **Units:** the period's runs and sessions (`periodUnits`), a run in its record's week and a session in its start's, as `contextSums` counts them. A `units` choice (all, runs, sessions) narrows them to one kind.
- **A unit counts** only with a non-null `phases`. The response carries, per week, how many of its units were left out, by kind. A stored unit can lack `phases` because the reporter couldn't read it, or because its last export came before CR13 (a unit the export no longer holds); the page doesn't tell the two apart and calls both "with no spend by phase".
- **Per week, phase and model:** cost. A model with no price (a null `cost`) adds nothing to any cost or share, keeps its column, and the response says the period holds one.
- **Per week and phase:** advisor calls and advisor cost, from the phases' `advisor`, for the table's two advisor columns. The reporter keeps advisor cost outside `models`, so it is outside every cost and share on the page (the owner's call, 2026-11-11: advisor cost stays apart, so the page's cost means what it means on Models and Weeks).
- **The groups** are the app's, in one table beside `phaseSums`, as Compliance's `FAMILIES`:
  - Plan: `design`, `plan_writing`, `plan_simplify`, `plan_review`
  - Implement: `implement`
  - Review and cleanup: `task_review`, `fix_check`, `simplify`, `final_review`, `final_fix_check`
  - Coordination: `coordination`
  - Unattributed: `unattributed`, and any phase name the table doesn't hold

### 3. The Spend page

A menu entry "Spend", between Models and advisor and Weeks, at `/spend`. Its response type is in `packages/shared/src/api/spend.ts`, built by `spendView` in `views/spend.ts`; its route block follows the other pages'.

- **Filters:** `ListFilters`' path, project and period, plus a Units switch (All, Runs, Sessions) as a `role="group"` of `Option`s, sent as a `units` query param.
- **With a path filter,** sessions are left out, as on every other page, so the switch is locked on Runs: "All" and "Sessions" are disabled options with a tooltip saying sessions have no path, and the server ignores `units` when a path is set.
- **The chart:** one stacked bar per week, stacked in the five groups in the order above, each week's total written above its bar. ECharts under the chart conventions, with the palette's first four light slots in fixed order for the first four groups and a neutral grey for Unattributed, a legend, and the chart's numbers as a table.
- **A note** under the chart: these are list-price estimates; how a week is counted; that Weeks and Home count runs only while this page also counts sessions, and leaves out units with no spend by phase; what unattributed is; how many units weren't counted, by kind, and the first week from which every week is fully counted; that advisor cost is counted apart; and, when the period holds one, that spend on a model with no price isn't counted.
- **The chart's table view** has a "units not counted" column, one count per week, so a short bar can be told from a cheap week.
- **The table,** over the whole period: one row per group that opens to its phases (the expanding-row convention), with cost, a `ShareBar` of the period's total, one column per model ID seen in the period, largest cost first, then advisor calls and advisor cost under a heading that says they are counted apart. A model with no price shows "–" in its column. A total row closes it. A group with one phase doesn't open. With many models the table scrolls sideways, under the scrolling table convention.
- **States:** empty (no unit with phases in the period), loading and error, as the other fetching pages.

### 4. Showing mode

- Every sum counts every project and session. The page lists no unit, so nothing is filtered out.
- Model names come from units, so they go through `maskText` before summing, as `modelSums` does.
- Phase and group names are fixed strings of the app.
- The view's tests run the leak check `leaks`, and `check:real`'s showing check includes the page's route.

### 5. `check:real`

- A line compares, over every run and session of the export with non-null `phases`, the phases' summed cost with the unit's `modelsCost`, and the phases' advisor calls and cost with the unit's `advisor`, to the cent: `phases: N compared, M differ`, or `not in the export` when no unit has `phases`.
- No comparison with a reporter total, since the export has none by phase.

### 6. Fixtures

- The latest fixture gains invented `phases` on its runs and sessions, adding up to each unit's `models` in cost, covering: every group, a run with null `phases`, a unit with an empty list, a session that is all unattributed, an unpriced model, and an advisor call in a phase.
- Story fixtures for the page are invented responses in `packages/web/src/test/spend.ts`.
- A Playwright screen and axe check for the page, as the other pages have.

### 7. `CLAUDE.md`

New lines under `## Code conventions`: `phaseSums` as the one sum of spend by phase and its unit rule; the groups table as the app's own grouping; a fixture's phases adding up to its `models`; `check:real`'s `phases` line.

## Left to the builder

- The response's exact shape and the component split.
- Which fixture file carries `phases` (a new version file or the latest one), under the fixtures' convention.
- The chart's ECharts options, with the `dataviz` skill loaded.

## Claude's calls, open to correction

- Unattributed is grey, so it reads as "the rest", not a fifth category.
- A unit with an empty `phases` list counts as read, with no spend.
- An unknown phase name falls under Unattributed.
- From the builder check: units with no `phases` are counted together under one wording; the gap with Weeks and Home is explained in the note, with no extra runs-only figure, since the path filter already gives one; advisor figures come from the phases.
- A model with no price keeps its column, showing "–", and the note says the period holds such spend.
- The schema reads no token count, since the page is cost only.

## Decided with the owner

From the grill on 2026-11-11, each replacing what the first draft and mockup held.

1. A Units switch (All, Runs, Sessions) beside the filters, in place of a special line under a path filter.
2. The groups follow the workflow's stages; "Reviews" is named "Review and cleanup", holding `simplify`, while `plan_simplify` and `plan_review` stay in Plan.
3. No Tokens switch: the page is cost only.
4. One column per model ID, largest cost first; the table scrolls sideways.
5. No tiles; the table gains an advisor cost column beside advisor calls.
6. Units with no spend by phase are counted per week, in the chart's table view, and the note names the first fully counted week. The bars carry no mark, and the gap is never filled from the unit's `models`.
7. With a path filter the Units switch is locked on Runs.
8. Advisor cost stays apart from every cost and share (before the grill).
