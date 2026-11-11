# Context cap, handoff chain and sweeper: design

Date: 2026-11-10, grilled 2026-11-11. Status: draft, awaiting the owner's approval. Path: Full (the import's schema and `COUNT_MAPS`, so stored derived values; a new page, view and route; showing mode; `check:real`). Builds on the live dashboard design (`2026-11-09-live-dashboard-design.md`, decisions 18, 20, 44 and "Totals are sums over units") and on the reporter's context cap change, `claude-workflow` [#26](https://github.com/shoklah/claude-workflow/pull/26) (its design: `docs/superpowers/specs/2026-11-10-context-cap-design.md` there), merged and installed. Issue: [shoklah/claude-workflow-dashboard#16](https://github.com/shoklah/claude-workflow-dashboard/issues/16). Mockup: `docs/design/2026-11-10-context-cap/context.html`.

## Intent

The workflow now caps a session's context at 300K tokens, hands work off to a fresh session past the cap, and sends lookups of five or more reads to a `sweeper` agent. The reporter measures all three. The owner wants to see whether the change works:
- as a trend, week over week
- with the runs and sessions behind it, to judge the ones that ran past the cap without a handoff

This follows decision 44: the app outlines the pattern and the units behind it, and the owner judges.

## What the reporter exports

`--json` stays at `version` 1. Every run and session gains three facts, all three `null` on a run with no transcript window, where the reporter couldn't read them. On a unit whose transcript it read but which has no main call of its own, `context` alone is `null`, meaning "no calls", while `tool_results` and `sweeps` are zeros. The reporter exports such a session whenever its transcript holds a run window.
- `context`:
  - `calls` and `tokens`. A call's tokens are input plus cache-read plus cache-write, from its largest iteration, counted once per `message.id`. So `tokens / calls` is a mean for any set of units.
  - `median_tokens`: per unit only, since medians don't sum.
  - `max_tokens`.
  - `over_cap`: whether any call went past `CONTEXT_CAP = 300_000`.
  - `calls_over_cap`: the calls after the first crossing, until the first handoff or compaction.
  - `handoff`: the ISO time of the first handoff after the crossing, else `null`.
- `tool_results`: characters of tool results by class, all seven keys always present: `read`, `edit`, `run`, `bash_other`, `agent`, `mcp`, `other`.
- `sweeps`:
  - `inline`: runs of five or more consecutive reads not followed by an edit of one of those files.
  - `delegated`: `sweeper` or `Explore` dispatches that launched.

`totals.context` is a list with one row per week. Each row is summed over the units whose `context` isn't null, a run in its record's week and a session in its start's week (`context_rows`). It holds `week`, `calls`, `tokens`, `max_tokens`, `units_over_cap`, `tool_results` by class and `sweeps` by kind.

`totals.health.info` gains two lines, each left out when its N is 0:
- `inline sweeps: N`
- `over the cap without a handoff: N transcripts`, counting transcripts where 50 or more calls ran past the cap with no handoff or compaction.

They are counted over this week's whole main transcripts, run rows and session rows together, so they are not sums over units.

## Goals

- **A Context page:** the weekly trend of context use, tool results and sweeps over a period, and the runs and sessions behind it.
- **A run's page** shows that run's context facts.
- **Compliance** shows the reporter's information lines, `totals.health.info`, as the static page does.
- **Facts agree:**
  - every weekly figure is a sum over stored units, and `check:real` compares it with `totals.context`
  - the information lines show as the reporter wrote them, marked as the reporter's
- **The static page's all-time context table is covered** (decision 20), through the Context page's table view over a period.

## Non-goals

- Any change to Home, the Sessions page or the Weeks page.
- A session detail page, or links to sessions.
- Parsing the information lines' text for their numbers.
- Marks for workflow changes on the charts. The owner wants every major change marked, from the reporter: CR16, filed as [shoklah/claude-workflow#30](https://github.com/shoklah/claude-workflow/issues/30). Until it lands, no mark shows, and the app hard-codes no date.
- Per-model context, and a median per call over a week. The reporter exports neither, and the owner wants no change request for per-model context now.

## Anti-goals

- The app and the reporter disagreeing on a context figure. The information lines' counts differ from the page's own sums by scope (whole transcripts this week, against units in a week), so they live on another page under the reporter's mark, never beside the sums as if they were the same fact.
- A session keeping a stale `context` or `handoff` after its rows move to a run, so its calls count twice.
- Showing mode leaking a hidden project's name, branch or session ID through the unit list, a handoff's successor or the information lines.
- The cap line passing for the reporter's fact while it is the app's default.

## Constraints

- **The reporter is the only parser** of transcripts. A missing fact goes to the workflow repo as a change request (CR14 to CR16 below).
- **Every new reporter field is `.nullish()`**, under `report.ts`'s convention.
- **Fixtures are invented.** The issue's real numbers go nowhere in this repo.
- **The screens follow the existing pages' look:** shadcn/ui, ECharts with the dataviz palette's light slots, share bars and `Option` switches. The UX/UI slice (#8) hasn't set a new direction.

## Approaches

**Purpose (the owner's pick).** Three were considered:
- **A trend added to the Weeks page:** the cheapest, but it shows no units to look at.
- **Per-unit columns on Sessions and a run's page:** finds outliers, but shows no trend.
- **One Context page with both. Picked.** It is also the only place where runs and sessions sit together: Weeks counts runs only, and Sessions lists sessions only.

**The weekly sums (the owner's pick).** Three were considered:
- **A new `contextSums` beside `weekSums`. Picked.** It mirrors the reporter's own split (`week_rows` over runs, `context_rows` over runs and sessions with a context), so `check:real` compares one list with one list.
- **Extending `weekSums` with sessions and a `context` field on `WeekRow`.** This would mix two unit sets in one row and change Home's and Weeks' responses for a page that doesn't show context.
- **Reading `totals.context` from the reporter.** Ruled out: it is all-time and already summed by week, so the path and project filters couldn't apply, and it breaks the rule that the app's figures are sums over units.

**The information lines (the owner's pick).** Three were considered:
- **Every line, as written, on Compliance. Picked.**
- **Only the two lines, picked out by their wording, on the Context page.** The page would depend on the wording and would put two different "inline sweeps this week" counts side by side.
- **A change request for structured counts first.** Nothing would show until it lands.

## Design

### 1. Import and storage

- **`packages/shared/src/report.ts`:**
  - `RunEntrySchema` and `SessionEntrySchema` gain three fields:
    - `context`: an object of `calls`, `tokens`, `median_tokens`, `max_tokens`, `over_cap`, `calls_over_cap`, `handoff` and `handoff_to`, CR15's proposed field for the successor session's key (section 10), absent until it lands
    - `tool_results`: `counts`, so a class the reporter adds later still sums
    - `sweeps`: an object of `inline` and `delegated`
  - `TotalsSchema` gains:
    - `context`: a list of rows of `week`, `calls`, `tokens`, `max_tokens`, `units_over_cap`, `tool_results` (`counts`) and `sweeps`
    - `health`: an object holding only `info` (`strings`)

  Every field is `.nullish()`, and nothing else in `health` is validated.
- **`packages/server/src/db/merge.ts`:** `context`, `tool_results` and `sweeps` join `COUNT_MAPS` (`true`), so each replaces the stored value whole when it isn't null. `handoff: null` is a known "no handoff", and CR6 can move a transcript's rows from a session to a run, so a merge key by key would keep a stale handoff.
- **The three facts are read as one group (the owner's call, from the builder check).**
  - **When a version's `tool_results` isn't null,** the reporter read the unit's transcript, so that version's `context` replaces the stored one, `null` included, meaning "no calls of its own". Otherwise a session that held calls before its run was logged would keep its old `context`, and its calls would count twice: in the run, and in the session.
  - **When all three are null,** the run had no window: the reporter couldn't read them, and the stored values stay, as every unknown fact does.
  - `mergeKnown` applies this one rule beside `COUNT_MAPS`.
  - `merge.ts`'s tests cover both cases.
  - `CLAUDE.md`'s `mergeKnown` line names it.
- `rebuildDerived` rebuilds merged rows at every start, so the rule reaches every stored unit and nothing stored is lost.

### 2. The weekly sums: `contextSums`

`contextSums(runs, sessions)` in a new `packages/server/src/views/context.ts` follows the reporter's `context_rows`. Its input is the units, as merged entries. Its output is one row per week start date, over the units whose `context` isn't null:
- **Which week:** a run counts in `weekOf(parseTime(record.date))`, a session in `weekOf(parseTime(start))`. A unit with neither is left out.
- **Sums:** `calls`, `tokens` and `unitsOverCap` (units with `over_cap`). `maxTokens` is the largest unit `max_tokens`.
- **By class and by kind:** `toolResults` sums by class and `sweeps` by kind. A missing class or kind counts 0.

The Context view adds, per row:
- `units`: how many units count
- `meanTokens`: `tokens / calls`, null when `calls` is 0
- `readShare`: `toolResults.read` over the sum of every class, null when that sum is 0

A week of the period with no unit is empty: every count 0, `meanTokens`, `maxTokens` and `readShare` null.

`CLAUDE.md` gets a line beside `weekSums`': the weekly context sums come only from `contextSums`, the reporter's `context_rows`, and `check:real` compares them with `totals.context`.

### 3. The Context page

**Route and query.**
- `GET /api/context`, with `periodQuery`'s `path`, `project` and `weeks`, plus `over=1`, read as the Sessions page reads `warnings=1`.
- The page defaults to 12 weeks, as Weeks does, and to `over=1`.
- The menu gets "Context" after Sessions, at `/context`.

**The view:** `contextView` in `views/context.ts`, a pure function of the stored runs and sessions, the query, `now` and the scope.
- It takes the period's units through `periodUnits`, so the filters work as everywhere else:
  - a run counts by its finish week, a session by its start week
  - the path filter leaves sessions out
  - a session's project key comes from its root only when that root is a stored run's
- The unit list needs the stored units, so it must reuse `periodUnits`' filtering (`period`'s `filters`, `periodSessions`), never a parallel path or project test. How is left to the plan.

**The response, `ContextResponse`** in `packages/shared/src/api/context.ts`:
- **`weeks`:** the period's weeks, oldest first, each with the sums of section 2.
- **`cap`:** the cap in tokens for the charts' line. It is `CONTEXT_CAP = 300_000` in `views/context.ts`, the app's default, until the reporter exports its own (CR14). The field is only for the line, and the page calls it the app's default.
- **`uncounted`:** the period's runs and sessions, under its filters and counting every project, whose facts are unknown (`tool_results` null or absent), as `{ runs, sessions }`. In practice these are runs with no transcript window, and units stored from exports before the change. A unit whose transcript was read but has no calls of its own (`context` null, `tool_results` known) isn't a gap, and isn't counted here.
- **`units`:** the period's runs and sessions with a `context`, only those with `over_cap` when `over=1`. They are ordered by `calls_over_cap` (most first), then `max_tokens` (largest first). Each row carries:
  - `kind` (`run` or `session`) and the unit's stored key
  - **a run:** its `runKey`, project name, branch and path, as `storedFacts` and `showFacts` give them
  - **a session:**
    - its title, masked, else null
    - its session ID, null while showing
    - its project name, null for "other project", named as the Sessions page names it
  - `at`: a run's finish (`record.date`), a session's `start`
  - the unit's `calls`, `median_tokens` as `medianTokens`, `max_tokens` as `maxTokens`, `calls_over_cap` as `callsOverCap`, `over_cap` as `overCap` and `handoff`
  - `handedOffTo`: the session the handoff started, named as a session row is (its title, masked, else null; its session ID, null while showing). It is null when the unit has no `handoff_to`, when the key matches no stored session, and while showing when `showSession` doesn't hold for that session.
  - its `readShare`, by the same rule as a week's
  - its `sweeps`
- **`hidden`:** how many units matching the query showing mode left out of `units`.

**The page,** `packages/web/src/context/ContextPage.tsx`, as the mockup draws it:
- **`ListFilters`** for path, project and period.
- **Five charts** through `Chart`, one measure each:
  - mean context per call
  - largest context
  - runs and sessions over the cap
  - read share of tool results
  - sweeps, `inline` in slot 1 and `delegated` in slot 2, with a legend

  The first two carry the cap as a dashed reference line labelled "cap 300K", in the chart chrome's ink, never a series colour. Tokens show in thousands ("281K").
- **A line under the charts:** what context is, which week a unit counts in, how many runs and sessions aren't counted (`uncounted`), and that the cap line is the app's default until the reporter exports its own.
- **The table view:** a `<details>` table, newest week first:
  - the week, units, calls, mean per call, largest and over the cap
  - characters by each of the seven classes, in thousands or millions
  - read share
  - inline and delegated sweeps

  It scrolls sideways through `containerProps`. Together with the charts, it covers the static page's all-time context table, over the period.
- **The unit list:**
  - **The switch** is an "Over the cap / All" `Option` group, on "Over the cap" by default.
  - **The columns:**
    - the kind, as an outline badge
    - the unit: a run as `runWhere`'s "project · branch · path", linking to its page; a session as `sessionName`'s title or "no title", with its `SessionChip` while not showing and its project or "other project" under it
    - when
    - calls, median per call and largest
    - past the cap
    - the handoff's time or "–"
    - "Handed off to": the successor's title or "no title", with its `SessionChip` while not showing, or "–" when `handedOffTo` is null. It fills in once CR15 lands (the owner's call: build the column now).
    - read share as a share bar (`SHARE_FILL` on `SHARE_TRACK`, its percent beside it)
    - sweeps as "inline · delegated"
  - **Showing mode:** a "+ N … in other projects" line from `hidden`.

### 4. A run's page

`RunResponse` gains `context`, null when the run's `context` is null. It holds:
- `calls`, `medianTokens`, `maxTokens`, `callsOverCap` and `handoff`
- `toolCharacters`, the sum of every class, and `readShare`
- `sweeps`

`RunPage`'s side column gets a Context section between Advisor and Warnings. It shows "None" when the run has no context, as Advisor does. Otherwise it has four lines:
- "268 calls · median 281K · largest 744K"
- "96 calls past the cap · no handoff", or "handed off Nov 4, 15:12"
- "Tool results: 1.3M characters · read 52%"
- "Sweeps: 4 inline · 1 delegated"

It holds only numbers and a time, so showing mode changes nothing on it.

### 5. Compliance's information lines

`ComplianceResponse` gains `information`, the latest export's `totals.health.info` lines as written:
- **The shape:** `{ lines: string[]; hidden: number; source: 'reporter' }`, a group of reporter figures.
- **Null** when `reporterTotals` returns null or the totals have no `health.info`.
- **With a scope,** `lines` is empty and `hidden` counts them. They can name any branch, so they are left out as Compliance leaves out its "other" rows.
- **The route** passes `lastGoodImport(db).totals` to `complianceView` as `totals`. The view reads it only through `reporterTotals`.

The page shows the lines below the grid and its list, under "Information from the reporter" with `ReporterMark`. A line under the heading says they are the latest export's information, not warnings, and not filtered by period. In showing mode it reads "N information lines are hidden while showing".

`CLAUDE.md`'s line listing the reporter figures gains "Compliance's information lines".

### 6. Showing mode

- **The sums** (`weeks`, `uncounted`) count every project, as every page's sums do.
- **The unit list** shows only:
  - runs that `showFacts` keeps, named by the scope
  - sessions that `showSession` holds, their titles masked with `maskText` and no session ID
  - a row's successor (`handedOffTo`) only when `showSession` holds for it, masked the same way
- **`hidden`** counts the rest that match the query.
- **The response's field names** avoid any common branch name, so no field is named `main`.
- **Leak tests:** the Context view's and Compliance's tests run `leaks` on their showing-mode responses, with a fixture holding:
  - context units in a hidden project
  - a session in a hidden root
  - an information line naming a hidden branch
  - a shown session handing off to a session in a hidden root
- **`check:real`'s showing check** adds `/api/context?weeks=52` to its routes. It also fetches Compliance with `resolved=1`, as today, and that response now carries `information`.

### 7. `check:real`

A new `context` line compares `contextSums` over every run and session of the export with `totals.context`, week by week:
- `calls`, `tokens`, `max_tokens` and `units_over_cap` exactly
- `tool_results` and `sweeps` through `sameCounts`
- a week the app or the export lacks differs

It prints `context: N compared, M differ`, then each differing week's date, since weeks name no project. When the export has no `totals.context`, it prints `context: not in the export`.

### 8. Fixtures

The invented fixture the dev server ends on, or a new one after it, carries:
- **The three facts on every unit.** A run with no window has all three null. A session holding a run window has no calls of its own: `context` null, `tool_results` and `sweeps` zeros.
- **A mix of context:**
  - units under the cap
  - over the cap with a handoff
  - over the cap without one
  - a handoff whose `handoff_to` names a stored session, and one whose key matches none
- **Weeks:** units in two weeks or more, and a week with no context.
- **`totals.context`** agreeing with its units by the reporter's rules. The fixture convention's list of rules gains `context_rows`.
- **`totals.health.info`** with the two context lines and a line naming a branch.

The older fixtures stay as they are, with no context, as exports from before the change. The leak-check fixture gains context units in a hidden project, an information line naming a hidden branch and a handoff to a session in a hidden root.

### 9. `CLAUDE.md`

One line each under `## Code conventions`:
- **The weekly context sums** come only from `contextSums` (section 2).
- **`mergeKnown` reads `context` with its version's `tool_results`** (section 1). This goes in the existing `mergeKnown` line.
- **The cap line's value** is `CONTEXT_CAP` in `views/context.ts` until CR14, shown as the app's default.
- **The reporter figures list** gains Compliance's information lines (section 5).
- **The fixture totals rule** gains `context_rows`.

### 10. Change requests

CR14 and CR15 stay in this spec until the workflow picks them up (the owner's call). CR16 is filed as an issue.

- **CR14: export the context cap.** The reporter exports its `CONTEXT_CAP` in `--json`. The shape is the workflow's call, for example `totals.context_cap`. Once CR14 lands, a small task of its own reads it into `cap` and drops the "app's default" wording. Until then the line is the app's default, 300K, by the owner's call.
- **CR15: export which session a handoff started.** On each unit whose `context.handoff` isn't null, the reporter exports the successor transcript's session `key` (the one `sessionKey` matches), for example as `context.handoff_to`. It already matches them in `handoff_map`. The shape is the workflow's call. The dashboard builds the "Handed off to" column now against `context.handoff_to` (the owner's call), so the column shows "–" until CR15 lands; if the shape differs, a small task moves the schema field only.
- **CR16: export dated workflow changes,** filed as [shoklah/claude-workflow#30](https://github.com/shoklah/claude-workflow/issues/30). The reporter exports a dated list of the major workflow changes, so the trend charts mark each one. Nothing is built for it in this plan: once it lands, a small task marks the changes in a period on the trend charts, labelled as the reporter's.

## Left to the builder

- How the Context view gets the period's stored units while reusing `periodUnits`' filtering: a variant returning stored units, or another shape.
- Where the session project naming shared with `sessionsView` lives, once two views use it (rule: reuse, never a parallel version).
- The exact field names of `ContextResponse` and the run's `context`, within section 3's and section 4's contents.
- The token and character formatting functions in `format.ts`, one per fact.
- The cap line in ECharts (a `markLine` or a line series) and its label's placement.
- Whether the fixture's facts go into the last fixture or a new one.
- The stories (empty, full, loading, error), e2e checks and screen baselines for the Context page, and the run page's and Compliance's re-rendered baselines.

## Claude's calls, open to correction

- **The default period is 12 weeks,** as Weeks, since the page is a trend.
- **The unit list covers the whole period,** with an "Over the cap / All" switch on "Over the cap", rather than opening a week clicked in a chart. A chart's bars are harder to make accessible than a list with a When column. The owner kept the two options: a "No handoff" option would match "Over the cap" until handoffs appear, and the reporter's 50-call threshold isn't the app's to copy. The sort puts the longest runs past the cap first.
- **A unit row shows its median per call,** the reporter's per-unit figure, which matches the baseline's measure; a week shows its mean, the only one that sums. The two are labelled apart.
- **No change to Home or the Sessions table.** The Sessions table has 11 columns already, and the Context page lists sessions.
- **The run page shows no successor.** A handed-off run's facts already read its whole chain, so the session it handed off to is part of the run.
- **An unknown successor shows "–",** whether CR15 hasn't landed or its key matches no stored session. The Handoff column already says whether a handoff happened.
- **Units whose facts are unknown** are counted in `uncounted`, never as zeros, and the reporter leaves them out of `totals.context` too. Units with no calls of their own are left out of both silently.
- **`tool_results` is read as `counts`,** so a class the reporter adds later still sums and its share stays right.
- **`check:real` compares only the one export's units with its totals,** as it does today. A stale merged `context` can only appear across versions, so `merge.ts`'s tests guard it, not `check:real`.
