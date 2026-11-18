# Work: goals, changes and the session graph

Status: approved by the owner on 2026-11-17, after the grilling. The dashboard's plan (`docs/superpowers/plans/2026-11-17-work-page.md`) starts on invented fixtures in parallel with the workflow's build of change requests 1 to 4 (the owner's decision); only its `check:real` task waits for the workflow's PR. Path: Full (new facts in the import's schema, new views, routes and pages, showing mode, `check:real`, fixtures, two routes redirected). Captures: `docs/design/2026-11-17-work/`, rendered on the real components with invented data, on the throwaway branch `claude/activity-mock` at `1e0bf75` (the Work and goal captures re-rendered after the grilling; the goal page's mocked Sessions table shows only the columns its mock data has), cut from `main` at `855395e` (the side menu and the run page redesign are both merged).

## Intent

This design started as "the menu feels dense, should some of the 11 pages merge?". The answer the owner reached is that the pages are not the problem: the Activity pages show two flat lists, Runs and Sessions, and nothing says how they relate or what they were for. A run is named by its branch. A change that took a design conversation, a plan and two implementation runs shows as unrelated rows on two pages. An effort like "the UI slice", made of several such changes, shows nowhere.

So the design adds the levels that were missing, and merges the two lists into the one page that shows them.

| Level | What it is | Where it comes from |
|---|---|---|
| **Goal** | An effort the owner names, such as "UI slice" | The workflow records it; the reporter exports it |
| **Change** | One design: a spec, its design and plan sessions, and the runs built from it | The spec's path, exported by the reporter |
| **Run** | One pass of the workflow, from a session's first message to its record | The record, as today, plus a title |
| **Session** | One conversation (a transcript) | As today, plus which session started it |

The question the Work page answers: what have I been working toward, and what did each effort take?

## Goals

- A run has a title that says what it achieved, shown wherever a run is named.
- Runs and sessions are grouped into changes, and changes into goals, with totals at each level.
- A goal and a change each have a page, with a graph of their sessions: which session started which, and where the runs happened.
- Runs and Sessions stop being two menu entries and become two views of the Work page. Every column and control they have today stays.
- Every fact comes from the reporter. Nothing is typed into the dashboard.

## Non-goals

- Any other page. Home, Weeks, Findings, Context, Spend, Compliance, Steps and rules, Skills and Models and advisor stay as they are. The owner decided to keep Weeks apart from Home: Home is "now", with fixed windows and no filters; Weeks is filtered history with tables of its own.
- Goals or changes on other pages (spend by goal, findings by goal, a goal filter on Home). Worth having later; not here.
- Creating, renaming or assigning a goal in the dashboard. The owner ruled it out: it would not be kept consistent.
- Backfilling titles, specs or goals in the dashboard, by a classifier or by hand. Older records gain them through the workflow's own backfill (change request 6), and the dashboard reads them like any others.
- The run's page, beyond the header facts named under "The run's page".
- The phone layout beyond what "At each width" says.

## Anti-goals

- A fact the dashboard works out by reading a branch name, a title or a file path. A unit with no goal has no goal.
- A total that counts a session's or a run's cost twice.
- A graph that is the only way to learn who started whom: each graph has its table.
- A goal's totals that include work started from it but given to another goal.

## Constraints

- The data rules hold. `workflow-report.py` is the only parser of the log and the transcripts; this repo never edits the workflow repo. Each new fact is a change request there (below), and until it lands the dashboard must work without it.
- The stack is fixed and no dependency is added. The graph is drawn as the run page's flow is: HTML boxes over SVG edges, no graph library.
- `DESIGN.md` holds: no panel in a panel, secondary ink only on a panel, colour only for data or state, one value per cell.
- Titles, goal names and spec paths are personal data: masked in showing mode like any text, and never in a fixture except as invented text.

## What the workflow must supply (change requests)

Written here so the workflow repo can take them as its own tasks. Field names are the workflow's to choose; the dashboard's schema follows what the reporter ships. Each fact is nullable: an older record has none. Three shapes are asked for, so the dashboard has nothing to guess: each fact sits on the unit's exported entry, as `title` and `key` do; a session exports at most one spec; and a starter is named by the reporter's own session `key`, as `handoff_to` names a successor.

1. **A run's title.** When a Small or Full path run finishes, the session writes one line into its record saying what the run achieved, in the same step that fills the record from the ledger. A plan record gets one too. The reporter exports it on the run, apart from the session's title it already exports.
2. **The spec.** Each plan record and each Full path run names the spec it comes from, as the spec's own project and its path under that project's root, since a change often spans repos: a run in one repo can be built from a spec kept in another. The reporter exports it on those units, and on each session it can tie to that spec (the sessions that wrote the spec, the plan record or the run's record, and the sessions linked to them by a handoff or a start), so a design session belongs to its change. A session tied to several specs exports the one of the newest record it holds, else the one of the session that started it.
3. **Who started a session.** For each session, the reporter exports the session that started it and how: `started` (through `start_session`) or `handoff`. Today only a handoff's successor is exported (`context.handoff_to`).
4. **The goal.** A workflow rule and a fact:
   - A session started from another session, or by a handoff, is given its goal in its brief. The starting session decides: the same goal when the task serves that goal's outcome, another goal or none when it doesn't. (The owner's examples: renaming the app during the UI work belongs to the UI goal, since the brand is part of the look; "by the way, start on the terms of use" does not.)
   - A session the owner starts directly states the goal in its first message, beside the path and stage. It picks one of the project's known goals when the request continues one, and otherwise proposes a name. The owner corrects it in words; no question is asked.
   - To pick consistently, the session reads the known goals from the log (a reporter command that lists them), across every project, since a goal can span repos.
   - The goal goes in the ledger and in the plan and run records. The reporter exports it on each run, plan record and session. A session with no goal exports none.
5. **One change per session.** A workflow rule, no new fact: when a new change comes up in a session (a new design, a new spec), it starts in a fresh session, through `start_session`, never in the same one. So a session holds the units of one change at most, and the dashboard's rule for a session holding two (below) covers only records from before it.
6. **A backfill of older records.** A one-off task in the workflow repo, after 1, 2 and 4, whose fields it fills: a session reads the older records with their ledgers and archives (`~/.claude/workflow-archive`) and proposes each record's title, spec and goal; the owner reviews the proposals once, and only then are they written where the reporter reads them. Nothing in the dashboard changes for it.

Requests 1 to 5 are independent of each other; 6 follows 1, 2 and 4. Requests 1 to 5 are filed and built first; the dashboard's plan starts once the reporter exports 1 to 4, so `check:real` has real fields to read. Records from before them still import: see "Before the facts arrive".

## Approaches

For the Activity entry page, four were rendered (`?variant=a|b|c|d` on `claude/activity-mock`):

- **A: one Work page, one table, a goal's row opening to its changes.** Compact, but goals read as rows among rows.
- **B: Runs and Sessions kept, a run gaining title, change and goal columns.** The smallest build, with no place for a goal or a change of their own, so "what is this effort costing" has no answer. Its columns are kept for the Runs view.
- **C: one Work page, a section per goal.** The owner liked how it reads, and saw it growing too long as goals accumulate.
- **D, chosen: C's sections, each opening and closing.** A goal active this week starts open; the others start closed, keeping their name and totals on one line.

For where a goal comes from: typed into the dashboard (rejected by the owner), or recorded by the workflow, inherited down the session chain and judged by the starting session (chosen).

For the level above a run, the owner's first thesis was "a spec equals a run, with design as its first step". This repo's history rules it out: one spec has produced four plans (`2026-11-09-live-dashboard-design.md`: slices 1, 2a, 2b, 2c), one plan has shipped as two runs (the UI slice, PRs 34 and 36), a Small path run has no spec, and a design can end with no run. So the spec identifies the change, the level above the run.

## Decisions the owner made

- The pages stay, except that Runs and Sessions become views of one page. Weeks stays its own page.
- A run gets a title, written by the session that finishes it, from its ledger. No classifier.
- Four levels: goal, change, run, session.
- A goal is never created or assigned in the dashboard. It is recorded by the workflow, automatically where it can be.
- A side task keeps its parent's goal only when it serves that goal; the link between the sessions shows in the graph either way.
- The Work page is layout D.
- A goal has its own page, with the graph of all its sessions.
- The change page and its graph, as mocked.

## The design

### The levels, as the dashboard builds them

- **A change** is the units that share a spec (its project and path): its runs, its plan records and its sessions, in whichever projects they ran. **A change's projects** are its units' roots; its **home project** is its spec's, else its one run's. Runs and plan records with no spec that share a plan file (`plan`, exported today) are one change, so an older plan record joins the run built from it. A run or plan record with neither is a change of its own.
- **A session is in one change at most:** the one of the spec the reporter gives it; else the change of the newest run or plan record it holds; else none. A session that held runs of two changes sits in the newer one's, and the older run's change shows that run with no session; the graph still draws the session once. Change request 5 makes this a case of older records only.
- **A change's title** is its newest plan record's title, else its newest run's title, else its spec's file name without the date and `-design.md`, else its run's branch. (Claude's call: the reporter exports no spec title, and this needs no new fact.)
- **A goal belongs to a change,** not to each unit: a change's goal is the goal of its newest unit that has one, and every unit of the change counts and shows under it, whatever its own. Units of one change normally agree; when they don't, the newest wins and nothing is flagged. A session in no change carries its own goal. The Goal column and filter of the Runs and Sessions views use the same rule. The "Other goals" lane and the anti-goal follow from it: a session started from this goal's sessions sits there when its change's goal (or its own, in no change) is another.
- **A change's path** is Full when it has a spec or a Full run, else Small. **Its stage** is the furthest it reached: Implementation with a Full or Small run, else Plan with a plan record, else Design.
- **A session's step** is what it held: Implementation when it holds a Full or Small run, else Plan when it holds a plan record, else Design. A session holding both reads Implementation.
- **A goal** is the changes and loose sessions that carry its name. It may span projects.
- **Totals.** A change's cost is the sum of its runs' and sessions' priced costs; the reporter already keeps a session's cost to its rows outside every run window, so nothing counts twice. Its findings are its runs' found findings. Its last activity is the latest of its runs' finishes and its sessions' ends; its start is its earliest session's start. A goal's totals are sums over its changes, plus the cost of its sessions that belong to no change.
- **A period** holds a change when any of its units is in it, and a goal when any of its changes is. **Filters choose what is listed; they never cut a change.** A listed change's numbers are its whole numbers, units outside the period included, since a change is one thing. A goal section's totals on the Work page are the sums of the changes it lists, so they match the rows under them; the goal's page shows the whole goal, whatever the filters were. So Work's totals over a period can be more than Weeks' or Spend's over the same weeks, which sum each unit in its own week: Work answers what each effort took, Weeks and Spend what the weeks cost. The page doesn't say so; this spec does. The project filter lists a change when any of its units ran in that project.

These sums live in one place, a new `views/work.ts`, as the other pages' sums do, with the response types in `packages/shared/src/api/work.ts`.

### Before the facts arrive

Every new field is `.nullish()` in the report schema. With none of them, each run is a change of one run named by its branch, every change sits under "No goal", and a graph shows only handoff edges. That is today's Runs list in another shape, so the page is usable from the first day and fills in as records gain the facts. The Work page says so once, in one line above the list, while no stored unit has a goal: "Runs recorded before goals existed show under No goal."

### The Work page, `/work` (`work-*`)

The question: what have I been working toward, and what did each effort take?

- **Title** "Work". **View** switch: Changes, Runs, Sessions (an `Options` group). **Filters**: Project, Goal and Period on the Changes view; the Runs and Sessions views keep today's filters and gain Goal.
- **Changes view.** One section per goal, most recently active first, "No goal" last. A section's title row holds a chevron button that opens and closes it, the goal's name as a link to the goal's page, and its totals: Changes, Runs, Sessions, Est. cost, Last activity. The title rows of all sections share one set of columns: the name's column is as wide on every row, a longer name wrapping inside it, and each total sits in its own column, numbers right-aligned, so the totals line up down the page whatever the names' lengths (the owner's note on the first captures). Open, it shows a table of the goal's changes: Change (a link to its page), Project (the home project, with "+N" for its other projects, a tooltip naming them), Path, Stage, Last activity, Runs, Sessions, Findings, Est. cost ($). A goal with a change active in the current week starts open; the rest start closed. "No goal" has no page and its name is plain text.
- Under the sections, one line when the period has sessions in no change: "4 sessions in this period belong to no change.", with a link to the Sessions view.
- **Runs view.** Today's Runs table and its "Has warnings" control, with three changes: its first column is "Run", the run's title linking to the run's page; a "Change" column links to the change's page (the dash, read "no design", for a change of one run with no spec); a "Goal" column. Branch stays, after Goal.
- **Sessions view.** Today's Sessions table, its opening rows and its "Has warnings" control, with "Change" and "Goal" columns added after Project. With `session=<key>` in the URL it lists that one session, whatever the period and the other filters, with its row open, under a chip naming it with a link that clears it, as Compliance's step chip does. A key that matches nothing, or a session showing mode hides, lists none and says so.
- The view is in the URL (`/work?view=runs`), so Back works and the redirects below can land on it.

### A goal's page, `/work/goals/$key` (`goal-*`)

The question: what did this effort take, and how did it spread?

- A link back to Work, the goal's name as the page title, and its facts as `Pairs`: Project (or "Several projects"), Started, Last activity, Changes, Runs, Sessions, Findings, Est. cost.
- **"How the work spread"**: the session graph (below), one lane per change, in order of each change's start, then a lane "No change" for the goal's sessions in none, then a lane "Other goals" for sessions started from this goal's sessions but given another goal.
- **Changes**: the same table as a section of the Work page, without Project when the goal has one project.
- **Sessions**: the table described under the change's page, with a Change column, since the graph needs its table. A goal can reach dozens of sessions; long tables wait on the tables work's pagination, as a long run's findings do.

### A change's page, `/work/changes/$key` (`change-*`)

The question: what did this design take, from the first conversation to the last run?

- A link back to Work, the change's title, and its facts: Goal (a link to the goal's page), Project (its home project) and Other projects when it has some, Path, Stage, Started, Last activity, Sessions, Runs, Est. cost, and Spec (the file's name) when it has one.
- **"How the work spread"**: the session graph in one lane, with sessions of other changes or goals that this change's sessions started, or that started them, drawn outlined.
- **Runs**: Run (title, linking to the run's page), Project when the change has several, Branch, Finished, Time (min), Tasks, Findings (Found, Closed), Est. cost ($). Plan records are listed too, with their path shown in a Path column when the change has one.
- **Sessions**: Session (its title, a link to `/work?view=sessions&session=<key>`), Step, Started, Started by (the starting session's title; the dash, read "started by you", when none), Length, Model, Run (the title of the run it holds), Est. cost ($).

### The session graph

- **A box** is a session: its title (a link, as in the Sessions table), its step, and "Run: <title>" when it holds a run (the newest when it holds several). A session of another change or goal is outlined dashed with no fill and says where it belongs ("Other change: <title>", "Goal: <name>").
- **An edge** runs from the starting session to the started one: solid for started, dashed for a handoff. A legend above the graph names the two and the dashed outline.
- **Placement.** A session's column is its distance from its chain's first session; in a lane, sessions sharing a column stack. A lane's label is its change's title, linking to the change. Edges leave a box's right side to a box in the same lane, and its bottom to a box in a lower lane.
- The graph is drawn at its own size and never shrunk: wider than its panel, it scrolls sideways in a focusable region named "Sessions of this goal, as a graph" (or "change"), with the edge cue.
- Edges are hidden from assistive tech; the boxes are in reading order, and the Sessions table's "Started by" column carries the same links as text.
- No box is pressed or selected: a box's links are its only controls.

### The run's page

- Its title becomes the run's title when it has one; the branch moves into the header facts. Without a title, the branch stays the title, as today.
- Its header gains Change and Goal (links) and Session (the session it ran in, opening in the Sessions view), each only when known.
- `RunLink` shows a run's title when it has one and its branch otherwise, so every place that names a run follows (Home's feed, the Sessions timeline, Compliance, Context, Findings).

### URLs and the menu

- `SECTIONS` in `layout/Menu.tsx`: Activity becomes **Work** (`/work`, the `Layers` icon) and **Findings**. Ten entries.
- `/runs` redirects to `/work?view=runs` and `/sessions` to `/work?view=sessions`. `/runs/$key` stays the run's page, and Work is the current entry on it and on every `/work/...` page.
- A goal's key is made from its name, a change's from its spec's project root and spec path, whichever project its units ran in (its plan file's when it has no spec, or its one run's key when it has neither), with the recipe `keys.ts` uses for runs and sessions. Both are the dashboard's own: the reporter exports no key for them.

### Showing mode

As every view: counts include every project and session; lists are filtered. Goal names, change titles, run titles, session titles and spec file names are text from units and are masked with `maskText`. A change is listed when its home project's root is shown; a goal when one of its changes is. A listed change's units in hidden projects count in its numbers but are not listed (no row, no graph box), and its hidden projects show only in the "+N" count, never by name. A graph leaves out the sessions `showSession` doesn't hold, drops the edges to them, and says how many it left out. A goal's or change's page answers only while Work lists it, else as a missing one, even when one of its units is shown; such a shown unit shows no change or goal in its row, and a graph box names them only as "Another change" or "Another goal" (the owner's ruling on the plan review, 2026-11-17). `views/work.ts` gets the `leaks` check like every view, and a goal name is added to the scope's hidden strings when none of its changes is shown.

### States

- **Loading:** the region's panel with "Loading the changes…" (or the goal, the change).
- **Empty, nothing imported or nothing in the period:** "No work in this period. A change shows here once one of its sessions or runs is imported."
- **Empty by filter:** "Nothing matches these filters.", with a control that clears them.
- **A graph with one session and no edge:** the one box, no legend.
- **A goal or change the key doesn't match:** "This goal isn't in the data any more.", with a link to Work.
- **Error:** "Couldn't load the changes." with the warning edge, as the other pages.

### At each width

- **1440 px:** as captured. A graph of up to six columns fits its panel.
- **768 px:** the tables scroll in their own regions with the edge cue; the graph scrolls sideways; the header facts wrap.
- **375 px:** the same, with the View switch and the filters wrapping under the title, and a goal section's totals wrapping under its name.

## Screens

`/work`, `/work?view=runs`, `/work?view=sessions`, `/work/goals/<a fixture goal's key>`, `/work/changes/<a fixture change's key>`, `/runs/<a fixture run's key>`.

## Components

| Component | Where | Status |
|---|---|---|
| `WorkPage` | `work/` | New: the view switch and the Changes view. The Runs and Sessions views render the existing tables. |
| `GoalPage`, `ChangePage` | `work/` | New pages. |
| `ChangesTable` | `work/` | New: no existing table lists changes. Used by a goal's section and the goal's page. |
| `SessionGraph` | `work/` | New. `RunFlow` lays out one run's stages and loops through `flow.ts`, whose shapes (stages, rounds, exit chips) don't fit a tree of sessions; the new graph follows its drawing (HTML boxes at computed rectangles over an `aria-hidden` SVG) and its box classes, with its own pure layout function beside it, tested like `flow.ts`. |
| `RowToggle` | `components/RowToggle.tsx` | Adapted: a variant whose chevron alone is the button and whose name is a link, for a goal's section. |
| `RunsTable`, `RunsPage` | `runs/` | Adapted: the Run, Change and Goal columns; the page becomes the Runs view. |
| `SessionsTable`, `SessionsPage` | `sessions/` | Adapted: the Change and Goal columns; the page becomes the Sessions view. |
| `ListFilters` | `runs/RunsPage.tsx` | Adapted: a Goal select, and Path left out on the Changes view. |
| `RunLink` | `components/RunLink.tsx` | Adapted: the title when there is one. |
| `RunPage` | `runs/RunPage.tsx` | Adapted: the title and the three header facts. |
| `Menu` | `layout/Menu.tsx` | Adapted: the Activity section's entries. |
| `Section`, `Panel`, `Pairs`, `PageTitle`, `Line`, `State`, `Options`, `Option`, `Table`, `Num`, `Text`, `EmptyRow`, `GroupHead`, `Time` | `components/`, `layout/` | Existing. |

## Left to the builder

- The field names in `report.ts`, as the reporter ships them, and one fixture, `report-work.json`, that carries all four facts.
- The graph's exact sizes and its layout function's shape.
- How the plan is cut. A natural order: the schema, keys and `views/work.ts` with their tests; the Work page's three views with the redirects and the menu; the change's page and the graph; the goal's page; the run's page and `RunLink`; `check:real`.
- `check:real`: a line comparing, counts only, the changes' and goals' cost totals with the sum of the units' costs, so a double count shows.
- The `## Code conventions` lines this design settles (where the levels are built, where a title is shown, the keys).

## Settled in the owner's grilling (2026-11-17)

- A goal belongs to a change: its newest unit's goal, for every unit of it, with no flag when units disagree.
- A listed change always shows its whole numbers; the period and project filters only choose which changes are listed.
- A session is in one change at most, and the workflow enforces it: a new change starts in a fresh session (change request 5).
- Older runs and plan records with no spec are joined into one change by their plan file. Older records gain titles, specs and goals through the workflow's backfill (change request 6), never a classifier in the dashboard.
- A goal may span projects, and is identified by its name alone; the known-goals list covers every project.
- A change may span projects: keyed by its spec's project and path, listed under its home project with "+N", matched by the project filter through any of its units.
- "No goal" has a section and no page.
- The page is named "Work" and its URLs are under `/work`.
- The goal's page has a Sessions table under its graph.
- A goal active in the current week starts open; the open state is not remembered between visits.
- A session's link opens it alone in the Sessions view, through `session=<key>`; there is no session page.
- A goal section's title row lines its totals up in columns shared by every section.

Still Claude's call, not raised in the grilling: a change's title, path and stage, and a session's step, are derived in the dashboard from facts the reporter exports, as listed under "The levels"; no change request asks for them.
