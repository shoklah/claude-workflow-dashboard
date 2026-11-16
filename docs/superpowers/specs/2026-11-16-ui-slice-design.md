# UI slice: every screen to night glass and the kit's floor

2026-11-16. Step 3 of the `ui` kit trial (kit 0.1.0, stack `react-tailwind-shadcn`, `look: direction`).

## Intent

The direction step gave the dashboard a look (`DESIGN.md`, night glass, with its light pair) and its tokens (PR #32). The screens were only re-skinned: they still carry the defects the kit's adoption audit found (values joined with "·", units in every cell, left-aligned numbers, raw ids, tiles, static text drawn as chips, pages wider than a phone). This slice restyles all twelve screens so each follows `DESIGN.md` and the kit's floor (`guidance.md`), in one design, so the shared patterns are decided once.

It is a presentation slice. The API, the views, the stored data and the reporter are untouched: every change is in `packages/web`, plus `DESIGN.md`, `CLAUDE.md` and the committed captures.

## Goals

- Each of the twelve screens matches its approved capture in `docs/design/2026-11-16-ui-slice/` at 1440 and 375 px, light and dark.
- One value per cell, units in headers, right-aligned tabular numbers, muted zeros, a muted dash for unknown, names in the reader's words, on every screen.
- One component per role: one panel, one labelled-pairs list, one disclosure, one state line, one option switch, one number cell.
- Text contrast that holds wherever a panel sits over the backdrop, proved by a test computed from the tokens (axe can't measure glass).
- The project's conventions in `CLAUDE.md` say what the screens now do.

## Non-goals

- **The run page's rethink.** The owner finds its data too condensed and wants a more visual part, such as diagrams; that is its own design session. Here the run page is restyled to the shared patterns only, as its capture shows.
- **Mobile as a design.** Screens fit, scroll in their own regions and pass the checks at 375 px, and the menu moves behind a Menu button. Layouts thought out for a phone are a later review; what was seen is parked in `docs/design/2026-11-16-ui-slice/mobile-review.md`.
- The themes picker (issue #30). New facts, new API fields, new pages. Motion.

## Anti-goals

- A second component for a role one already fills, or a string built by hand where a formatter exists.
- Real data in a fixture, story, capture or test.
- A screen that passes axe while its text is unreadable over an orb.

## Constraints

- The data rules of `CLAUDE.md` hold unchanged (privacy, facts only from the reporter, showing mode's masking in the views).
- The stack is fixed. No new dependency. No shadcn component is added: the mobile menu uses the `Dialog` already installed, so the owner has no CLI command to run before the plan.
- Tokens live only in `packages/web/src/index.css`; no colour, type size, radius or shadow literal in a component.
- Every changed or new component keeps or gets its Storybook stories (empty and full; loading and error where it fetches); a story with an interaction test is the UI's failing test.
- The Playwright screenshot baselines of every screen change, in light and dark, and are regenerated in the container (`pnpm test:screens`).

## Approaches

How the design was shown and agreed:

- **A. A throwaway build on the real components (picked by the owner).** The screens were restyled for real on a local branch, `claude/ui-slice-mock`, served on fixtures, checked with the kit's screens check and captured. It shows the true look and catches what a drawing hides (overflow, wrapping, dark mode). Cost: most of the UI is built twice.
- B. Static HTML mockups, as earlier slices did. Cheaper, but the glass, the charts and the tables' real widths can't be judged from them.
- C. Stories only, component by component. No whole screen to approve.

How it gets built (my call, for the owner to check): **the mock is the reference source, ported under tests, not merged.** The mock has no updated stories, tests or baselines, carries capture scripts, and was never reviewed, so it can't be merged. But it holds the approved result file by file. Each task ports its files from `claude/ui-slice-mock` (readable in any worktree with `git show claude/ui-slice-mock:<path>`), writing the stories and tests first. The branch stays local and is deleted once the slice is merged. Rebuilding from the captures alone would redo solved work and drift from what was approved.

## Decisions the owner made

- **The floor wins over the "·" conventions.** Breakdowns become sub-columns, small tables or labelled pairs; "project · branch" becomes two cells. The `CLAUDE.md` conventions are rewritten here (see Conventions).
- **Units go in the header, cells hold plain numbers with a fixed number of decimals.** Costs are "Est. cost ($)" with "12.40"; durations in tables are whole minutes under "(min)". Tiles and prose keep "$12.40" and "2 h 10".
- **One exception: a session's length is adaptive**, "45 min", "7 h 46", "3 d 11 h", under a plain "Length" header, right-aligned. Sessions run from minutes to days, and neither minutes nor decimal hours read well across that range (the owner compared the three on the mock).
- **ReporterMark** is muted small text with a dotted underline that opens its explanation, never a pill.
- **The backdrop takes primary ink only** (see Contrast).
- **Home:** the week's tiles become one panel of four small tables; the findings chart has its own row, with cost and warnings side by side under it; the feed is a panel whose items hold labelled pairs, with a swatch in place of the coloured side border.
- **Every switch is an option-pill group**; `Tabs` is dropped.
- **Times** read "Nov 12, 10:20" (24-hour) wherever a day and time is shown.
- **Models' stage cells** hold a model over its effort in secondary ink (two values in one cell, accepted).
- **Warnings** show without the "WARN:" prefix and without the run's own "branch (date):" lead, for display only; the session a warning names trails on its own line.
- **Sessions:** a row holds counts (skills, commands typed, never loaded, runs); names show only in its timeline.
- **Context:** a session's ID is not repeated in the name cell.
- **Methodology notes** fold under their table as "How X is counted".
- **Spend:** the total comes first, as "All phases".
- **Findings:** "Labelled by the app" is a column of the heatmap; a finding's label is plain text with a "Labelled by" column.
- **Context's sweeps** are blue and aqua (series 1 and 3), so orange keeps one meaning, warning.
- **Compliance's information lines** are split at ": " into labelled pairs, for display only.
- **Weeks' charts** sit two by two below 1536 px, four across from there.
- **Under 768 px** the menu rail is replaced by one header row: Menu, showing mode, Refresh. Menu opens the page list in a dialog, closed by following a link.
- **Native selects and the native checkbox stay**, styled from the tokens.

## Contrast

### The rule

Text directly on the backdrop (the page title, filters' labels, lines, disclosure summaries, section titles) is in primary ink. Secondary ink, warning ink and every other status ink appear only on a panel. A line that needs to be quieter goes on a panel or is shortened; it is never muted on the backdrop.

### Why

Computed from the tokens, at the worst place a text can sit (an orb's centre over each stop of the gradient, with the panel's tint and its brightest sheen on top):

| Dark, worst case | Primary | Secondary | Warning ink |
|---|---|---|---|
| Backdrop | 4.61 | 3.23 | 2.60 |
| Panel | 7.73 | 5.41 | 4.35 |
| Table header band | 5.68 | 3.98 | 3.20 |
| Row hover | 5.14 | 3.60 | 2.90 |

Light passes 4.5:1 on every panel surface (warning ink 4.79 at worst) and fails only for warning ink on the backdrop (3.2), which the rule covers. In dark, every worst case is the teal orb's centre. So the rule alone is not enough: secondary ink in a header band or a hovered row, and warning ink anywhere on a panel, fall under AA when the panel is over the teal orb.

### The fix: tune the dark tokens until the test passes

**Open for the owner (it changes the look `DESIGN.md` records, slightly):** the dark tokens are tuned so every ink passes 4.5:1 on every panel surface at the worst case. A tuning that does it, computed: the teal orb from 55% to 30% opacity, warning ink from `#ffb08a` to `#ffc2a3`, the panel tint from 55% to 62%, the header band from 12% to 10% white and the row hover from 16% to 11%. The implementer may find a smaller set, in this order of preference: the teal orb, the warning ink, the band and hover, the panel tint last. `DESIGN.md` is updated with the final values, and the captures are rendered again if the change is visible beside them.

The alternative, not recommended: keep the tokens and accept 3:1 for warning ink and for secondary ink in bands and hovered rows. That is under AA for 14 px text.

### The test

A Vitest test in `packages/web` reads `src/index.css` as text, takes the tokens for `:root` and `.dark`, and computes WCAG contrast with plain arithmetic (no browser, no axe):

- Backdrop colours: each gradient stop, and each orb's colour at its opacity over each stop. Light: each blob's colour, and the background.
- Surfaces: the panel tint over each backdrop colour, with each end of the sheen; then the header band (`--secondary`) and the row hover (`--accent`) over that.
- Asserted at 4.5:1 or more: primary ink on every backdrop colour; primary, secondary and warning ink on every surface; notice ink on the notice bar over every backdrop colour; each `--on-shade-*` ink on its `--shade-*` step (the zero step over every surface).

The blur and the 160% saturation are left out: a blur only averages towards colours already in the set, and the test says so in a comment. The test fails on today's tokens; that failure is the tuning task's failing test.

The backdrop rule itself is checked by review and by a small e2e check: on each screen, no element with `text-muted-foreground` or `WARNING_INK` has the page's backdrop as its nearest painted ancestor (no ancestor that is a `glass` panel, a table container, a dialog, a popover or a notice bar).

## Shared patterns

Each is marked existing, adapted (from what), or new (and why nothing existing fits). The reference for each is the mock's file of the same path.

| Pattern | Where | Status |
|---|---|---|
| `PageTitle`, `SectionTitle` | `components/Panel.tsx` | New: titles were hand-classed per page at the wrong sizes (F34). They use new `text-page-title` and `text-section-title` theme tokens (28 px/700, 16 px/600). |
| `Panel` (title, optional aside) | `components/Panel.tsx` | New: wraps the existing `glass` utility with a titled section; replaces per-page `div.glass` and the unused shadcn `Card`. |
| `Pairs` | `components/Panel.tsx` | New: a definition list, name in secondary ink, value right-aligned in tabular figures. Replaces tiles, "·" sentences and key/value tables. Used only inside a panel. |
| `Details` | `components/Panel.tsx` | New: the one disclosure (a chart's table view, "How X is counted"), its summary underlined in primary ink since it sits on the backdrop. Replaces per-page `details` in muted text. |
| `Line` | `components/Panel.tsx` | New: a page's one-line sentence on the backdrop, in primary ink. |
| `State` | `components/Panel.tsx` | New: a region's loading or error line on a panel (the error with the warning edge). Replaces per-page muted paragraphs on the backdrop. |
| `NUM`, `Num`, `Unknown`, `Text` | `components/Num.tsx` | New: a numeric column's alignment class; a number with zero muted; the muted dash read out as "not known"; a text value or the dash. Replaces per-cell `NONE` handling. |
| `Option` group | `findings/FindingsPage.tsx` | Existing, now a pill (`rounded-control`) and used for every switch. A group on the backdrop has a visible label ("Measure", "Area", "Count", "Show", "Warnings"). |
| `ReporterMark` | `components/ReporterMark.tsx` | Adapted: dotted-underline text, same tooltip and `mark` prop. |
| `WarningText` | `components/WarningText.tsx` | Adapted: shows `warningBody` and trails the session chip on its own line; takes the run's `branch`. |
| `SessionChip` | `components/SessionChip.tsx` | Adapted: tabular figures, no monospace. |
| `HeatmapTable` | `components/HeatmapTable.tsx` | Adapted: full width; an `extras` prop for numeric columns after the weeks; group headings small and muted; cells 32 px high at body size; a zero total muted. |
| Table, grouped headers | shadcn `Table` | Existing. A breakdown is a two-row header: the group's name over its sub-columns, the other headers spanning both rows. |
| `Menu`, `MenuButton` | `layout/Menu.tsx`, `layout/Shell.tsx` | Adapted: `Menu` takes `onNavigate`; `MenuButton` is new and opens it in the existing `Dialog` under 768 px. The rail is hidden under 768 px. The shell's header wraps the import banner under the controls there. |
| `Time` | `layout/StatusBanner.tsx` | Adapted: "Nov 12, 10:20". |
| `Chart` | `home/WeeklyCharts.tsx` | Existing. `SERIES` is exported; chart titles are section titles with the unit ("(tokens)", "($)"); the x axis always shows the latest week; a cap label sits at the line's start. |
| `ShareBar`, `CategoryBadge`, `CoverageNote`, `ListFilters` | as today | Existing. `CategoryBadge` renders plain text; `ListFilters`' path select shows `PATH_LABELS`. |
| Checkbox | `index.css` | Existing native input, with `accent-color` from `--primary`. |

`format.ts` gains: `PATH_LABELS` and `pathLabel`; `modelLabel` ("claude-opus-5-5" as "Opus 5.5") and `splitPair`; `formatDollars` ("12.40" under "($)"); `formatWhole`; `formatLength`; `formatCompactFixed` ("2.0M"); `capitalize`; `warningBody`; `STEP_LABELS.simplify` becomes "Simplify".

Removed, once nothing calls them: `countsLabel`, `nonZeroCountsLabel`, `advisorLabel`, `sessionsSummary`, `byAppSplit`, `judgedInvalidLabel`, `runName`, `ofLabel`, `modelsLabel`, `projectLabel`, `yesNoLabel`, `warningsSummary`, `labellerLabel`, `outcomesLabel`, `stopLabel`, `uncountedLabel`, `RULE_LABELS`, `runWhere`, `findingsLabel`, `NO_NAMES`, `actedOnSplit`, `stageTableLabel`, `advisorRolesLabel`, `SUCCESS_BORDER`, with their tests; and the shadcn files `badge.tsx`, `card.tsx`, `tabs.tsx`. `joined` stays while `appCallLabel` and `strengthWhere` use it.

## The screens

For every screen: the capture is `docs/design/2026-11-16-ui-slice/<name>-<width>-<mode>.jpg`; at 1440 px the layout is as captured; at 768 px the rail is still shown and side columns stack under the main content (they sit beside it from `lg`); at 375 px the Menu button replaces the rail and every table scrolls sideways inside its own panel. Loading and error are a `State` panel; the texts below are the ones to keep.

### Home, `/` (`home-*`)

- **Question:** what happened this week, and what is new since I last looked?
- **Layout:** a "This week" panel of four small tables (Runs: All paths, Small, Full, Plan; Findings: Found, Acted on, Open; Est. cost ($): All runs, A run; Warnings: Current, New), each with This week and Last week columns, two by two from `sm`, four across from `2xl`. The workflow diagram on a panel with a Full path / Small path switch, each box holding Ran, Found, Acted on, and the fix-checks line under the flow. The findings chart on its own row; cost and warnings side by side under it from `lg`; the coverage note; "The charts as a table". Skills and commands. The feed, "Since you last looked", as a side panel from `lg` (18 rem), each item a branch link, its project and path, and labelled pairs (Findings, Acted on, Open, Time, Est. cost).
- **States:** loading "Loading the home screen…"; error "Can't load the home screen."; feed empty "Nothing new. Finished runs and new warnings show here until you mark them seen."; skills empty "No skill loaded and no command typed in this period."
- **Components:** `Panel`, `Pairs`, `Details`, `Num`, `Option`, `Chart`, `ShareBar`, `WarningText`, `Time`, shadcn `Table` (existing or above).

### Runs, `/runs` (`runs-*`)

- **Question:** which runs finished, and how did each go?
- **Layout:** filters with "Has warnings"; one table: Branch, Project, Path, Finished, Time (min), Tasks, Waves, Findings [Found, Closed], Stops, Est. cost ($), Warnings; the branch is the row's link; the hidden-by-showing-mode line.
- **States:** "Loading the runs…"; "Couldn't load the runs."; empty "No runs in this period. A run shows here once its record is written and imported."
- **Components:** `ListFilters`, `Num`, `Text`, `Time`, `State`, `Line`.

### Run, `/runs/:key` (`run-*`)

- **Question:** what happened in this run? (Its rethink is out of scope.)
- **Layout:** the branch as title; a header panel of labelled facts (Project, Path, Stage, Time, Est. cost, Findings, Closed, Warnings); a Timeline / Findings switch; a side panel from `lg` (20 rem) with Skills, Models, Advisor, Context (as `Pairs`) and Warnings, each with its own "none" line. The findings table has plain-text labels, a "Labelled by" column and a "Fix-check verdicts" column.
- **States:** "Loading the run…"; "Couldn't load this run."; "No strengths recorded."; "No skill loaded."; "No model recorded."; "Not consulted."; "No context facts for this run."; "No warnings."; "No findings match these filters. Set a filter back to All to see more."
- **Components:** `Pairs`, `Option`, `FindingsTable`, `RunTimeline`, `WarningText`, `CategoryBadge`.

### Findings, `/findings` (`findings-*`)

- **Question:** what do reviews keep finding, and is it acted on?
- **Layout:** filters; labelled "Measure" and "Area" switches; the heatmap at full width with Total and "Labelled by the app" columns; the labeller's line; the selected cell's findings table; a signals side panel from `lg` (20 rem) as `Pairs` (Fix commits, Final review findings, Fix-check "not proportionate", Declined or ruled, Judged invalid; then Labelled by the app, Waiting, Labeller tokens this week).
- **States:** "Loading the findings…"; "Couldn't load the findings. Check that the dashboard server is running, then refresh."; empty "No findings in this period. A finding shows here once a run with a review is imported."; "Select a cell to list its findings."; "Every label here is the app's, until the workflow labels findings itself."; "The labeller is off: the data folder's .env holds no API key."
- **Components:** `HeatmapTable` (adapted), `FindingsTable`, `Panel`, `Pairs`, `Option`, `Line`, `State`.

### Sessions, `/sessions` (`sessions-*`)

- **Question:** what did each session do, and did its skills load?
- **Layout:** filters with "Has warnings"; one table: Session, ID, Project, Started, Length, Model, Effort, Est. cost ($), Skills, Commands [Typed, Never loaded], Runs, Startup (Loaded or Missing), Warnings. A session with several models lists one per line, its effort beside it. The session's name is the toggle; its detail row is a small table (Time, What, Name, Outcome). "How sessions are listed" under the table.
- **States:** "Loading the sessions…"; "Couldn't load the sessions. Check that the dashboard server is running, then refresh."; empty "No sessions in this period. A session shows here once the reporter reads its transcript."; timeline empty "No skill loads, commands or runs in this session."
- **Components:** `SessionChip`, `Num`, `Text`, `Unknown`, `Time`, `Details`, `Line`, `State`.

### Context, `/context` (`context-*`)

- **Question:** how full does context get, and where do the tokens go?
- **Layout:** filters; five charts, two across from `sm`, three from `xl`, titled with their unit; "The charts as a table"; "How context is counted"; the units table with a "Show" switch (Over the cap, All) beside its title: Name, Kind, Project, When, Calls, Context (tokens) [Median per call, Largest], Calls past the cap, Handoff [At, To session, ID], Read share, Sweeps [Inline, Delegated]. Kind is "Run" or "Session" as text.
- **States:** loading, error and empty as today's texts, on a `State` panel.
- **Components:** `Chart`, `Details`, `Option`, `Num`, `Unknown`, `SectionTitle`.

### Compliance, `/compliance` (`compliance-*`)

- **Question:** which rules were broken, and is anything new?
- **Layout:** filters with a "Warnings" switch (Current, Including resolved) and the step chip when a step is set; the count line; the heatmap at full width; the selected cell's warnings as a table (Run, Project, Warning, Since you last looked); a panel "Information from the reporter" with its mark, as `Pairs`.
- **States:** "Loading the warnings…"; "Couldn't load the warnings. Check that the dashboard server is running, then refresh."; "No warnings to show in this period: showing mode leaves out other projects."; "No warnings in this period. A warning shows here when the reporter flags a run or session."; "Select a cell to list its warnings."
- **Components:** `HeatmapTable`, `Panel`, `Pairs`, `ReporterMark`, `WarningText`, `Option`.

### Steps and rules, `/steps` (`steps-*`)

- **Question:** what does each step and rule find, and what does it cost?
- **Layout:** two titled tables. Steps: Step, Ran, Found something, Counts [Count, Number], Findings by outcome [Fixed or applied, Declined, Deferred, Open or to owner], Tokens, Est. cost ($). Rules: Rule, Ran, Found something, Counts [Count, Number], Est. cost ($). A row's counts are one line each.
- **States:** "Loading the steps and rules…"; "Couldn't load the steps and rules. Check that the dashboard server is running, then refresh."
- **Components:** shadcn `Table`, `Num`, `SectionTitle`, `State`.

### Skills, `/skills` (`skills-*`)

- **Question:** which skills load, and with what outcome?
- **Layout:** one table: Skill, Runs and sessions, Required but missing, Last loaded, Loads, by outcome [Outcome, Loads], one line per outcome with the skill's cells spanning them; "How skills are counted" under it.
- **States:** "Loading the skills…"; error as today; empty "No skill loads in this period. A skill shows here once a run or session loads it."
- **Components:** shadcn `Table`, `Num`, `Unknown`, `Time`, `Details`.

### Models and advisor, `/models` (`models-*`)

- **Question:** did agents and sessions run on the model they should, and what does the advisor cost?
- **Layout:** Agents table: Agent, Requested [Model, Effort, Dispatches], Ran on [Model, Effort, Dispatches], Mismatches (reporter mark). Main sessions table: Path, Recommended by stage [1, 2, 3, Out] (reporter mark), Ran on [Model, Effort, Sessions], Differs. Advisor, three across from `lg`: a "This period" panel of `Pairs` with the trial line, "Advisor calls by role" (Role, Calls, May consult), "Failed calls" (by error, Calls). Then "Advisor spend by week": Week, Advisor ($), Fable ($), Share (%), Past the stop share.
- **States:** "Loading the models and advisor…"; "No dispatches in this period. An agent shows here once a run or session dispatches it."; "No advisor facts: the export is from before the reporter counted them."; "No advisor calls in this period."; "No failed calls in this period."; "No advisor weeks in this period."
- **Components:** shadcn `Table`, `Panel`, `Pairs`, `ReporterMark`, `Num`, `Text`, `Unknown`.

### Spend, `/spend` (`spend-*`)

- **Question:** where does the money go, by phase?
- **Layout:** filters with a "Count" switch (All, Runs, Sessions); the chart "Estimated cost by week, by phase group ($)"; "The chart as a table"; the table: Phase, Est. cost ($), Share, By model ($) [one column per model], Advisor, counted apart [Calls, Cost ($)], with "All phases" first and each group a row that opens to its phases (chevron, swatch); "How spend is counted" under it.
- **States:** loading, error and empty as today's texts, on a `State` panel.
- **Components:** `Chart`, `ShareBar`, `Details`, `Option`, `Num`.

### Weeks, `/weeks` (`weeks-*`)

- **Question:** how do the weeks compare?
- **Layout:** four small charts, two across from `sm`, four from `2xl`; the coverage note; "By week": Week, Runs [Small, Full, Plan], Tasks, Final review findings [Critical, Important, Minor, Not required], Fix rounds, Stops, Usage (points) [Fable, All models], Est. cost ($), Time per run (min), Later fix commits; then "Full runs, with and without waves": Kind, Runs, Median time (min).
- **States:** "Loading the weeks…"; error as today; empty "No runs in this period. A week fills once a run that finished in it is imported."
- **Components:** `Chart`, `CoverageNote`, shadcn `Table`, `Num`, `SectionTitle`.

### The menu under 768 px (`menu-375-*`)

- One header row: Menu, showing mode, Refresh; the import banner wraps under it. Menu opens a dialog at the top left titled "Pages" with the same links as the rail; following one closes it; Escape and the close button close it.

## Conventions to rewrite in `CLAUDE.md`

Under Design conventions:

- `DESIGN.md` is the look and wins where it and the kit's floor disagree; the code conventions below follow it, and a convention that contradicts it is the one to change (the export's F52).

Under Code conventions, rewritten:

- **Display formatting** (the `format.ts` rule): adds that a table cell holds a plain number under a header naming its unit ("Est. cost ($)" with `formatDollars`, "(min)" with whole minutes), that tiles and prose keep `formatCost` and `formatMinutes`, and that a session's length is the one adaptive cell, through `formatLength`.
- **Counts by key:** `countsLabel`, `nonZeroCountsLabel` and the "small 4 · full 2" form are gone. A breakdown is sub-columns under a group header, a small table, or `Pairs`; never a joined string.
- **A finding's category** is plain text through `categoryLabel`; who labelled it is the table's "Labelled by" column, and the Findings grid's "Labelled by the app" column replaces the "N · M by the app" split (still shown only once a finding of the period carries the workflow's label).
- **ReporterMark** is dotted-underline text, never a badge.
- **A page's switch** is an `Option` pill group with a visible label when it sits on the backdrop; no tabs.
- **Every page fits from 375 px:** adds the Menu button under 768 px and that the rail is hidden there.
- **A table row that opens a detail row:** the detail may be a small table of its own.
- **Stories' providers, fixtures:** unchanged.

Under Code conventions, new:

- Text on the backdrop is in primary ink only; secondary and status inks appear only on a panel; `contrast.test.ts` computes every ink's contrast from the tokens and must pass.
- Page structure comes from `components/Panel.tsx` (`PageTitle`, `SectionTitle`, `Panel`, `Pairs`, `Details`, `Line`, `State`); a page writes no title, panel, disclosure or state markup of its own.
- A number cell is `Num` under a `NUM` header: zero muted, unknown as `Unknown`'s dash.
- A model shows through `modelLabel`, a path through `pathLabel`, a severity, outcome or phase capitalised through `capitalize`; no raw id or lower-case kind on screen.
- A day and time shows through `Time` ("Nov 12, 10:20").
- A warning's text shows through `WarningText`, never raw.

`DESIGN.md` changes: the tuned dark tokens (if approved); Layout's "a wrapped bar above the page under 768px" becomes the Menu button; Table gains the session-length exception; Typography's title sizes are now tokens.

## Tests and checks

- Unit tests for each new `format.ts` function, beside the existing ones.
- Stories for `Panel.tsx`'s parts and `Num.tsx`'s, and updated stories for every changed component; the stale ones (the sweep found ten story files and six e2e specs referring to removed text, tabs or roles) are rewritten with their screen, first, as the failing test.
- `e2e/shell.spec.ts` gains the Menu button at 375 px (opens, lists the pages, closes on follow) and keeps the no-sideways-scroll check at 375, 768 and 1440.
- The contrast test and the backdrop-ink e2e check above.
- Screens baselines regenerated for all twelve screens, light and dark, in the container.
- The kit's checks per task: `screens` on the task's paths, `tokens`, `catalog`.

## Delivery

One design, likely more than ten tasks, so two pull requests: first the shared patterns (tokens and contrast, `Panel.tsx`, `Num.tsx`, `format.ts`, the adapted shared components, the shell and menu, the conventions), then the screens. A screen's task is independent of the other screens once the first PR's patterns exist, so screens can run in waves.

## Known gaps, accepted

- A table that scrolls sideways at 375 px shows no cue (parked in `mobile-review.md`).
- Weeks' "Full runs" table spreads three columns over the full width.
- A zero in secondary ink is hard to tell from primary ink in dark; the tuned tokens don't change that.

## Left to the builder

- The order of screens and how they group into tasks and waves.
- Whether `Option` moves out of `findings/FindingsPage.tsx` into `components/` now that every page uses it (it should, if a move is all it takes).
- The exact tuned token values, within the order of preference above.
- How the backdrop-ink e2e check finds "on a panel" (a class list, or computed background up the ancestors).
- Fixed column counts in detail rows (`colSpan`) as constants or computed.
