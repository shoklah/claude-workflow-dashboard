# The Spend Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Spend page at `/spend` showing the reporter's spend by phase (CR13): estimated cost per week in five groups, and by phase and model over the period.

**Architecture:** The import validates the units' new `phases` field; nothing new is stored, since units' raw JSON is kept whole. One pure function, `phaseSums`, sums phases per week; `spendView` turns the period's sums into the page's response, and one route serves it. The web page follows the Context page: `ListFilters`, a stacked ECharts chart with its table view, and an expanding-row table.

**Tech Stack:** TypeScript, zod, Hono, Vitest, React, TanStack Router and Query, ECharts, shadcn/ui, Storybook, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-11-spend-page-design.md`. Mockup: `docs/design/2026-11-11-spend/spend.html`.

## Global Constraints

- Fixtures are invented: never real project paths, branch names, session IDs, costs or finding text.
- `workflow-report.py` is the only parser: the page reads `phases` as exported and never derives a phase. This repo never edits the workflow repo.
- Costs are the reporter's list-price estimates; the app keeps no price table.
- Advisor cost is outside every cost and share on the page.
- The page is cost only: no token figure, no tiles.
- Relative imports carry their `.ts`/`.tsx` extension, type-only imports use `import type`, and code stays erasable-only TypeScript.
- A time from the reporter becomes a `Date` only through `parseTime`; a week is named through `weekOf`.
- A route never masks or filters: only the view applies the scope, with `maskText`.
- Shares are whole-scale percents (0 to 100), as `formatShare` and `ShareBar` take them.
- Every task ends green on `pnpm -r typecheck` and `pnpm vitest run`.

## Review Focus

1. A phase name the app doesn't know (the reporter adds one): the import still passes, the phase counts under Unattributed and shows its slug with spaces. Test in Task 2.
2. A period whose total is 0: with no phase counted, every share is null (never `NaN`) and the page shows its empty state; with only unpriced models (`path=plan` on the fixture), shares are null too but the table shows, its model columns `–`, with the unpriced note. Tests in Tasks 2 and 4.
3. A typed URL with `units=sessions` and a `path`: the response is the path's runs only. Test in Task 2.
4. A stored unit with `phases` whose later version has `phases: null`: the known value stays. Already pinned for any array by `merge.test.ts`'s 'an array replaces' and 'a null array keeps the known one'; `phases` gets no `COUNT_MAPS` entry.

---

### Task 1: `phases` in the schema and the fixture

**Files:**
- Modify: `packages/shared/src/report.ts` (a `PhasesSchema` beside `ModelsSchema`; `phases` on `RunEntrySchema` and `SessionEntrySchema`)
- Modify: `packages/shared/fixtures/report-v7.json` (invented `phases` on its units)
- Test: `packages/shared/test/load.test.ts`

**Interfaces:**
- Produces: `RunEntry['phases']` and `SessionEntry['phases']`, both `{ name: string; models?: Models | null; advisor?: { calls?: number | null; cost?: number | null } | null }[] | null | undefined`, where `models` is the existing `ModelsSchema`'s type, so `modelsCost` works on a phase's `models`.

- [ ] **Step 1: Write the failing tests**

In `load.test.ts`, with the file's `test` and its own way of loading a fixture (as its totals test at l.146; `loadReport` returns `{ ok, report }`), importing `modelsCost`:

- `"report-v7's phases add up to each unit's models and advisor"`: over the report's runs and sessions with `phases != null`, there are 9; for each, the phases' summed `modelsCost(p.models) ?? 0` is `toBeCloseTo(modelsCost(unit.models) ?? 0, 6)`, the phases' summed `advisor.calls` equals `unit.advisor?.calls ?? 0`, and their summed `advisor.cost` is `toBeCloseTo(unit.advisor?.cost ?? 0, 6)`.
- `'keeps a phase name the app does not know'`: with `runs[4].phases[0].name` set to `'a_new_phase'` in a copy of the fixture, the load is `ok` and the loaded run's first phase is named `'a_new_phase'`.
- `'reads a null phases'`: the loaded `runs[0].phases` is `null`.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm vitest run packages/shared/test/load.test.ts`
Expected: both FAIL (no `phases` in the fixture, the field stripped).

- [ ] **Step 3: Add the schema**

`const PhasesSchema = z.array(z.object({ name: z.string(), models: ModelsSchema, advisor: z.object({ calls: num, cost: num }).nullish() })).nullish();` and `phases: PhasesSchema,` on both entry schemas. `cost_by_kind` stays unread.

- [ ] **Step 4: Add the invented phases to `report-v7.json`**

Runs and sessions are in file order (r0 to r6, s0 to s4). Each phase is `{ "name", "models": { "<model>": { "cost" } }, "advisor": { "calls", "cost" } }`, phases in the reporter's order (the spec's list of twelve), with no token counts, which nothing reads. Costs below; `advisor` is `{ "calls": 0, "cost": 0 }` where not given.

| Unit | Phases (model: cost) |
|---|---|
| r0, r1, r2 | `"phases": null` |
| r3 | `design` (`claude-fable-6-preview`: null), `plan_writing` (`claude-sonnet-9-preview`: null) |
| r4 | `design` fable-5-1 1.6; `plan_writing` fable-5-1 1.2; `plan_simplify` opus 0.4; `plan_review` fable-5-1 1.475; `implement` opus 5.1, advisor 4 / 0.34; `task_review` opus 1.5; `fix_check` opus 0.4; `simplify` opus 0.5; `final_review` opus 0.9; `final_fix_check` opus 0.22; `coordination` opus 0.5, advisor 1 / 0.08 |
| r5 | `plan_writing` fable-5-1 1.2; `plan_review` fable-5-1 1.255; `implement` opus 4.0, advisor 3 / 0.27; `task_review` opus 1.1; `final_review` opus 0.8; `coordination` opus 0.38 |
| r6 | `implement` opus 0.5, advisor 1 / 0.03; `final_review` opus 0.15; `coordination` opus 0.06 |
| s0 | `unattributed` opus 0.12 |
| s1 | `design` opus 0.14; `unattributed` opus 0.10 |
| s2 | `design` opus 0.45; `plan_writing` opus 0.35; `coordination` opus 0.25 |
| s3 | `unattributed` opus 0.41, advisor 1 / 0.06 |
| s4 | `"phases": []` |

"opus" is `claude-opus-5-5`, "fable-5-1" is `claude-fable-5-1`, as the units' own `models` name them.

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run && pnpm -r typecheck`
Expected: PASS, the other fixture tests included.

- [ ] **Step 6: Commit**

```bash
git add packages/shared
git commit -m "feat: the units' phases in the schema and the fixture"
```

---

### Task 2: `phaseSums`, `spendView` and `GET /api/spend`

**Files:**
- Create: `packages/shared/src/api/spend.ts`, `packages/server/src/views/spend.ts`
- Modify: `packages/shared/src/index.ts` (export the new api file), `packages/server/src/routes.ts` (one block after Context's), `CLAUDE.md` (`## Code conventions`)
- Test: `packages/server/test/spend.test.ts`

**Interfaces:**
- Consumes: `RunEntry['phases']` (Task 1); `periodUnits`, `addCount` from `views/runs.ts`; `maskText`, `leaks`, `forbiddenStrings` from `views/scope.ts`; `periodQuery` in `routes.ts`.
- Produces, in `packages/shared/src/api/spend.ts`:

```ts
export type SpendUnits = 'all' | 'runs' | 'sessions';
/** `GET /api/spend`'s query: the period's, plus `units`. */
export type SpendQuery = FindingsQuery & { units: SpendUnits };
export type SpendGroup = 'plan' | 'implement' | 'review' | 'coordination' | 'unattributed';
/** `byModel` holds every model of the response's `models`: 0 with no spend on it in this row, null in every row when the
 * reporter has no price for it. Advisor figures are outside `cost` and `share`. */
export type SpendRow = { cost: number; share: number | null; byModel: Record<string, number | null>; advisor: { calls: number; cost: number } };
export type SpendPhase = SpendRow & { name: string };
export type SpendGroupRow = SpendRow & { group: SpendGroup; phases: SpendPhase[] };
export type SpendWeek = { week: string; groups: Record<SpendGroup, number>; total: number; uncounted: { runs: number; sessions: number } };
export type SpendResponse = {
  weeks: SpendWeek[];          // the period's, oldest first
  groups: SpendGroupRow[];     // all five, in SPEND_GROUPS' order; a group's phases are those with a counted entry, in the reporter's order
  total: SpendRow;             // share null
  models: string[];            // largest cost first, unpriced ones last
  unpriced: boolean;           // the period holds spend on a model with no price
  fullFrom: string | null;     // the first week from which every week has nothing uncounted; null when the last week has
};
```

- Produces, in `packages/server/src/views/spend.ts`:

```ts
/** The app's grouping of the reporter's phases; a name it doesn't hold counts under 'unattributed'. */
export const SPEND_GROUPS: Record<SpendGroup, string[]>
export function groupOf(phase: string): SpendGroup
export type PhaseSums = {
  phases: Record<string, { byModel: Record<string, number | null>; advisor: { calls: number; cost: number } }>;
  uncounted: { runs: number; sessions: number };
};
/** Spend by phase per week start date, over the units given: a run in its record's week, a session in its start's. */
export function phaseSums(runs: RunEntry[], sessions: SessionEntry[], name?: (model: string) => string): Map<string, PhaseSums>
export function spendView(input: { runs: StoredUnit<RunEntry>[]; sessions: StoredUnit<SessionEntry>[]; query: SpendQuery; now: Date; scope: Scope | null }): SpendResponse
```

`SPEND_GROUPS` holds the spec's five groups (`review` is "Review and cleanup": `task_review`, `fix_check`, `simplify`, `final_review`, `final_fix_check`).

- [ ] **Step 1: Write the failing tests** in `packages/server/test/spend.test.ts`, building the database as `context.test.ts`'s `dbWith()` does, with a `spend(query)` helper beside its `context(query)`.

`phaseSums` over report-v7's runs and sessions, all weeks together:
- the summed cost of every phase and model equals the summed `modelsCost` of the units with `phases` (25.06: runs 23.24, sessions 1.82), `toBeCloseTo`;
- advisor: 10 calls, cost 0.78;
- `uncounted` summed over the weeks is `{ runs: 3, sessions: 0 }` (r0 to r2);
- `claude-fable-6-preview` under `design` is `null`, never 0;
- with `name: () => 'x'`, every `byModel` key is `'x'` and the totals are unchanged.

`phaseSums` over inline units (the Review Focus cases):
- a run with `phases: [{ name: 'a_new_phase', models: { m: { cost: 2 } } }]` sums under `a_new_phase`, and `groupOf('a_new_phase')` is `'unattributed'`;
- a run with `phases: []` adds nothing and isn't `uncounted`; one with `phases: null` is `uncounted`;
- a model priced in one unit and null in another sums to the priced cost.

`spendView` (weeks 52):
- `groups` has the five groups in order; `review`'s `phases` names are `task_review`, `fix_check`, `simplify`, `final_review`, `final_fix_check`; `implement`'s cost is 9.6 and its advisor `{ calls: 8, cost: 0.64 }`;
- the groups' `share`s sum to 100 (±0.01) and `total.cost` is 25.06; each week's `total` is the sum of its `groups`, and the weeks' totals sum to `total.cost`;
- `models[0]` is `'claude-opus-5-5'`, the two preview models come last, and `unpriced` is `true`; `implement`'s `byModel['claude-fable-5-1']` is 0, and `byModel['claude-fable-6-preview']` is null in every group and phase row;
- `path: 'plan'` (r3 only): `total.cost` 0, every `share` null, `models` the two preview models, `unpriced` true, and `plan`'s `phases` names `design` and `plan_writing`;
- `units: 'runs'` gives `total.cost` 23.24, `units: 'sessions'` 1.82;
- `path: 'full'` with `units: 'sessions'` equals `path: 'full'` with `units: 'runs'` (total 22.53);
- a query whose period holds no counted unit (`path: 'small'` narrowed with a `project` that has none, or the file's own way to get an empty period): `total.cost` 0, every `share` null, no `NaN` anywhere in `JSON.stringify`;
- `fullFrom` is `'2026-11-08'` (the uncounted runs are in the weeks of 10-04, 10-18 and 11-01), and null over a copy of the fixture whose r6 has `phases: null`;
- the leak check, as `context.test.ts` l.261-278 with its `branches` map: a showing-mode response gives `leaks(...)` `[]`, also over a copy of the fixture where a hidden project's run has a phase named as that project's folder (F9: an unknown phase name is a string from a unit).

The route: `GET /api/spend?weeks=52&units=sessions` answers 200 with `total.cost` 1.82; `units=nonsense` answers as `units=all`.

- [ ] **Step 2: Run to see them fail**

Run: `pnpm vitest run packages/server/test/spend.test.ts`
Expected: FAIL, `views/spend.ts` not found.

- [ ] **Step 3: Implement**

- `phaseSums`: as `contextSums` finds each unit's week (`record?.date`, `start`, `weekOf(parseTime(...))`, a unit with no time skipped). A unit with `phases == null` adds 1 to its week's `uncounted`. A model's cell starts absent, becomes the sum of its non-null costs, and is `null` only while every cost seen for it is null. `spendView` makes the rows dense: every row's `byModel` holds every model of `models`, null when the model's cell is null wherever it appears in the period, else 0 where the row has no spend on it.
- `spendView`: `periodUnits` for the period's units and weeks; `units: 'runs'` drops the sessions and `units: 'sessions'` with no `path` drops the runs (`periodUnits` already leaves sessions out under a path); `phaseSums(runs, sessions, (m) => maskText(scope, m))`; a phase name no group of `SPEND_GROUPS` holds leaves as `maskText(scope, name)`, grouped by its raw name; every period week appears in `weeks`, zeros where it has no sums. A `share` is `100 * cost / total.cost`, null when the total is 0. `unpriced` is true when any `byModel` cell is null.
- The route block, after Context's: `const units = c.req.query('units'); const query: SpendQuery = { ...periodQuery(c), units: units === 'runs' || units === 'sessions' ? units : 'all' };` then `listUnits` for runs and sessions and `c.json(spendView({ ..., scope: scopeFor(runs, sessions) }))`.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run packages/server/test/spend.test.ts && pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 5: Add the conventions to `CLAUDE.md`**, under `## Code conventions`, after the context sums' line:

- Spend by phase is summed only by `phaseSums` in `packages/server/src/views/spend.ts`, over the units with a non-null `phases`, a run in its record's week and a session in its start's; a unit without counts in its week's `uncounted`, never filled from its `models`; a model the reporter has no price for stays null, and advisor cost stays outside every cost and share.
- The Spend page's five groups are the app's, only in `SPEND_GROUPS` and `groupOf` beside `phaseSums`; a phase name the table doesn't hold counts under `unattributed`.
- A fixture's `phases` add up to its unit's `models` in cost and to its `advisor` in calls and cost.

- [ ] **Step 6: Commit**

```bash
git add packages/shared packages/server CLAUDE.md
git commit -m "feat: spend by phase, its view and its route"
```

---

### Task 3: `check:real`'s `phases` line and showing route

**Wave:** A

**Files:**
- Modify: `packages/server/src/check-real.ts` (a `phases` line after the context comparison; `'/api/spend?weeks=52'` in the showing check's `paths`; its header comment), `README.md` ("Checking your real data": the new line and page), `CLAUDE.md` (`## Code conventions`: one clause in check:real's line)
- Test: `packages/server/test/check-real.test.ts`

**Interfaces:**
- Consumes: `RunEntry['phases']` (Task 1), `modelsCost`, the file's `differLine(label, compared, differ, names)`.

- [ ] **Step 1: Write the failing tests**, in the file's style (beside the contexts test, l.141):
- the whole-output test of report-v7 (l.150-156) gains `phases: 9 compared, 0 differ` in its expected text (r3 to r6 and s0 to s4, s4's empty list against no cost); every other expected output in the file gains its `phases` line too, between `context:` and `showing:` (`OLD_TOTALS`, the whole-output texts and the `toContain('…\nshowing: pass\n')` assertions);
- with one phase cost changed in a copy of the fixture, `phases: 9 compared, 1 differ`, and the line names no unit;
- with one phase's advisor calls changed, `1 differ` too;
- over a fixture with no `phases` (report-v6), `phases: not in the export`.

- [ ] **Step 2: Run to see them fail**

Run: `pnpm vitest run packages/server/test/check-real.test.ts`
Expected: the new tests FAIL (no `phases` line).

- [ ] **Step 3: Implement**

Add `'/api/spend?weeks=52'` to the showing check's `paths` (no test of its own: the response names no project, so the file's alias leak can't show there). Over every run and session of the export with a non-null `phases`: the unit differs when the phases' summed `modelsCost` isn't the unit's `modelsCost` (null as 0) to the cent, or the phases' advisor calls or cost (to the cent) aren't the unit's `advisor`'s (null as 0). `differLine('phases', \`${compared} compared, \`, compared ? differ : null, false)`: a count only, since a unit can name a project.

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run packages/server/test/check-real.test.ts && pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 5: `CLAUDE.md`, `README.md` and the script's header comment**: name the `phases` line and the Spend route where the README's paragraph and the header list check:real's lines and pages, and extend `CLAUDE.md`'s check:real comparison line with: "its `phases: N compared, M differ` line compares each unit's phases with its `models` cost and its `advisor`, a count only".

- [ ] **Step 6: Commit**

```bash
git add packages/server CLAUDE.md README.md
git commit -m "feat: check:real compares the phases with each unit's models"
```

---

### Task 4: The Spend page

**Wave:** A

**Files:**
- Create: `packages/web/src/spend/SpendPage.tsx`, `packages/web/src/spend/SpendPage.stories.tsx`, `packages/web/src/spend/SpendTable.tsx`, `packages/web/src/spend/SpendTable.stories.tsx`, `packages/web/src/test/spend.ts`
- Modify: `packages/web/src/findings/FindingsPage.tsx` (`Option` gains `disabledReason`), `packages/web/src/runs/RunsPage.tsx` (`listPath` takes `units`), `packages/web/src/home/WeeklyCharts.tsx` (`barsOption`: a series' optional `color`, `cost` and `totals`; `SPEND_GROUP_COLORS`), `packages/web/src/lib/format.ts` (labels), `packages/web/src/router.tsx`, `packages/web/src/layout/Menu.tsx`, `packages/web/src/layout/Menu.stories.tsx` (its `Default` story's link list gains `Spend`), `CLAUDE.md` (`## Code conventions`: the web lines)
- Test: the stories' interaction tests; `packages/web/src/lib/format.test.ts` (`phaseLabel`: a step kind, `plan_writing`, an unknown name)

**Interfaces:**
- Consumes: `SpendResponse`, `SpendUnits`, `SpendGroup`, `SpendGroupRow` from `@cwd/shared` (Task 2); `ListFilters`, `listPath`, `useProjects`, `useLiveQuery`, `Chart`, `barsOption`, `ShareBar`, `formatCost`, `STEP_LABELS`, `NONE`.
- Produces:
  - `Option({ pressed, onClick, children, disabledReason? }: { ...; disabledReason?: string })`: with a reason, a disabled button inside a focusable span whose tooltip shows the reason (the Tooltip pattern of `runs/FindingsTable.tsx` l.77-84).
  - `listPath(base, query & { ..., units?: SpendUnits })`: appends `units` unless it is `'all'` or undefined.
  - `barsOption(weeks, series: { name; data; color? }[], { stack?, legendRoom?, totals? })`: `color` overrides the palette slot; `cost: true` formats the axis and tooltip as `singleBars`' `cost` does; `totals: true` writes each stack's total above its bar, through `formatCost` with `cost`.
  - In `WeeklyCharts.tsx`, beside `SERIES`: `export const SPEND_GROUP_COLORS: Record<SpendGroup, string>`, the palette's first four slots in the groups' order and `'#b5b4ad'` for `unattributed`, for the chart's series and the table's swatches.
  - In `format.ts`: `phaseLabel(name: string): string` (`STEP_LABELS`' label where the name is a step kind, else `countLabel(name)`, as `kindLabel` does, the whole in lower case as the mockup writes phases: `plan simplify`, `fix-check`, `design`), `SPEND_GROUP_LABELS: Record<SpendGroup, string>` (`Plan`, `Implement`, `Review and cleanup`, `Coordination`, `Unattributed`).
  - `SpendPage()`, no props, at `/spend`; `SpendTable({ response }: { response: SpendResponse })`.

Load the `dataviz` skill before the chart work.

- [ ] **Step 1: Write the story fixtures** in `src/test/spend.ts`: invented `SpendResponse`s `spendFull` (the mockup's figures: 8 weeks, five groups, its three models plus a fourth with no price, null in every row, `unpriced: true`, `uncounted` 3 runs in the first week and 1 session in the second, `fullFrom` the third week) and `spendEmpty` (weeks with zeros, `total.cost` 0, shares null, `models: []`).

- [ ] **Step 2: Write the failing stories** in `SpendPage.stories.tsx`, as `ContextPage.stories.tsx` stubs the API with `mockApi`: `Loading`, `Failed`, `Empty`, `Full`, `PathFilter` (on `spendFull`); and in `SpendTable.stories.tsx`: `Full` (`spendFull`) and `Empty` (`spendEmpty`: five group rows at `$0`, no toggle, no model column). Interaction tests:
- `SpendTable`'s `Full`: the table shows `Review and cleanup`, no `task review` row (exact text) until its group's toggle (`aria-expanded="false"`) is clicked, then five phase rows; `Implement` and `Coordination` have no toggle; under a "By model" heading the columns read `claude-opus-5-5`, `claude-fable-5-2`, `claude-haiku-5-5` in that order, then the unpriced model, whose cells show `–`, then advisor `Calls` and `Cost`.
- `SpendPage`'s `Full`: the chart's `role="img"` element has its aria-label; the note holds "4 units with no spend by phase (3 runs, 1 session)" and the first fully counted week, and says spend on a model with no price isn't counted; the chart's table view has a "Units not counted" column; clicking `Sessions` requests `/api/spend?...units=sessions`.
- `PathFilter` (path `full`): `Runs` is pressed, `All` and `Sessions` are disabled, and the request carries no `units=sessions`.
- `SpendPage`'s `Empty`: the text "No spend by phase in this period.", no table, no `NaN`.

- [ ] **Step 3: Run to see them fail**

Run: `pnpm vitest run packages/web/src/spend`
Expected: FAIL, `SpendPage` not found.

- [ ] **Step 4: Implement**

- `SpendPage`: the query state as `ContextPage` keeps it (its default period; the mockup's 8 weeks is no `ListFilters` period), plus `units`; `useLiveQuery<SpendResponse>(listPath('/api/spend', { ...query, units }))`; `ListFilters` with the Units switch as its children (`role="group"`, `aria-label="Units"`). With `query.path` set, `Runs` shows pressed and the other two pass `disabledReason="Sessions have no path"`.
- The empty state shows when no group has a phase (not when the total is 0: a period of unpriced models still shows its table).
- The chart: `Chart` titled "Estimated cost by week, by phase group", `barsOption` stacked, one series per group in `SPEND_GROUPS`' order, each with its `SPEND_GROUP_COLORS` colour, `cost: true`, `totals: true`, `legendRoom: 28`. Its table view in a `<details>`, as Context's, with the five groups, the total and "Units not counted" (runs and sessions added).
- The note, one paragraph, in the mockup's words (without its list of the weeks holding uncounted units, which the table view's column gives): list-price estimates; the five groups are the app's grouping of the reporter's phases; a week sums its runs by finish and its sessions by start; Weeks and Home count runs only; what unattributed is; when any unit is uncounted, "Not counted: N units with no spend by phase (R runs, S sessions)" and "every week from <fullFrom> is fully counted" when `fullFrom` isn't null; advisor cost is counted apart; when `unpriced`, spend on a model with no price isn't counted.
- `SpendTable`, under a "By phase, over the period" subheading: the expanding-row pattern of `SessionRows` (a `button` with `aria-expanded` in the first cell), a group with one phase having no toggle and its phases shown as rows under it, not as a full-width detail; a group's name after a swatch of its `SPEND_GROUP_COLORS` colour; columns Phase, Cost, Share (`ShareBar`), one per `response.models` under a "By model" heading, then advisor Calls and Cost under a "Advisor, counted apart" heading; a total row; a null model cost shows `NONE`; `containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Spend by phase' }}` so it scrolls sideways.
- Router: a `/spend` route as Context's. Menu: `{ to: '/spend', label: 'Spend', exact: false }` between Models and advisor and Weeks.

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run packages/web && pnpm -r typecheck && pnpm build`
Expected: PASS; the other pages' stories still pass with the changed `Option`, `listPath` and `barsOption`.

- [ ] **Step 6: `CLAUDE.md`**, under `## Code conventions`, beside the lines they extend:
- A phase's name shows through `phaseLabel` and a spend group's through `SPEND_GROUP_LABELS`, both in `format.ts`; a group's colour, in the chart and the table's swatches, comes only from `SPEND_GROUP_COLORS` in `home/WeeklyCharts.tsx`, Unattributed a neutral grey outside the palette, so it reads as "the rest".
- In the existing expanding-row line, at its end: "; a row that opens to rows of its own columns (the Spend table's groups) keeps the toggle and shows them as rows under it".
- In the existing "A page's switch" line, after "so its tooltip still opens": "through `Option`'s `disabledReason` prop".

- [ ] **Step 7: Commit**

```bash
git add packages/web CLAUDE.md
git commit -m "feat: the Spend page"
```

---

### Task 5: The page's checks and screens

**Failing-test check:** exempt: checks and screenshots of a page Task 4 already built and tested through its stories

**Files:**
- Create: `packages/web/e2e/spend.spec.ts`, `packages/web/e2e/spend.screens.ts`, `packages/web/e2e/spend.screens.ts-snapshots/`
- Modify: `packages/web/e2e/shell.screens.ts-snapshots/menu-screens-linux.png` (the menu's new entry; page screens capture `main` only, so no other baseline changes)

**Interfaces:**
- Consumes: the page at `/spend` on dev:fixtures' data (Tasks 1, 2 and 4); `pinClock` from `e2e/fixed-time.ts`.

- [ ] **Step 1: Write the check**, as `e2e/context.spec.ts`:

```ts
test('the spend page shows the groups, opens one to its phases and has no axe violations', async ({ page }) => {
```

It opens `/spend`, sees the chart's `role="img"` and the five group rows, opens `Plan` and sees `design`, picks `Sessions` and sees the total change, and runs the file's axe check. And `e2e/spend.screens.ts`, as `context.screens.ts`: `toHaveScreenshot('spend.png')`.

- [ ] **Step 2: Run the check**

Run: `pnpm --filter @cwd/web exec playwright test --project=checks e2e/spend.spec.ts`
Expected: PASS (the page exists since Task 4; a failure here is a finding against the page, fixed in the page with its own failing story test).

- [ ] **Step 3: Run the screens, then write the two baselines**

Run: `pnpm test:screens`
Expected: only `shell.screens.ts`'s menu and the new `spend.screens.ts` fail. Any other page's failure is a regression from Task 4's shared helpers (`barsOption`, `Option`): fix it in the code, with its own failing story test, never by updating that baseline.
Then: `pnpm test:screens --update-snapshots e2e/spend.screens.ts e2e/shell.screens.ts` and `pnpm test:screens`
Expected: PASS. Look at `spend-screens-linux.png` against the mockup.

- [ ] **Step 4: Run everything**

Run: `pnpm -r typecheck && pnpm build && pnpm vitest run && pnpm --filter @cwd/web exec playwright test --project=checks`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/e2e
git commit -m "test: the Spend page's checks and screens"
```
