# Run page: the run drawn as a graph

2026-11-16, approved captures of 2026-11-17. Built with the `ui` kit (0.1.0, stack `react-tailwind-shadcn`, `look: direction`).

## Intent

The run page (`/runs/:key`) lists a run's steps, findings, agents and skills as stacked tables. The owner finds it too condensed and wants it visual: the page should show **what was done and how**, the review loops, and what was left for later, and "a visual tool should be visual, not said".

This slice redraws the page around one drawing, the run as a graph, and reorders the rest of the page under it. It is the first screen designed under the rule **show, don't tell** (see Conventions).

**The question the screen answers:** how did this run go: what ran, in what order and side by side, where it looped, and what it left open?

## Goals

- The run is drawn as a graph that reads without a legend: parallel work forks and merges, a fix loop is an arc, what a step left leaves the line.
- The graph fits its panel at every width from 375 px up and never scrolls sideways.
- Selecting a step shows its findings one line each, round by round, and narrows the tables under the graph to that step.
- Problems and strengths are told apart at a glance, by colour and icon as well as by title.
- The page matches its approved captures in `docs/design/2026-11-16-run-page/` at 1440 and 375 px, light and dark.

## Non-goals

- **The findings table's own rework** (its twelve columns, its sideways scroll). The owner set it aside as a separate slice over every table of the dashboard. Here the Problems table keeps today's columns.
- **Lanes by agent**, a second drawing the owner tried and dropped. It earns its place only once the reporter ties each dispatch to its task (change request 1).
- **The implementer on a task's box**, the **stopping step's mark** on the graph (issue #35) and the **kit's wider data** on the graph (issue #22). Each waits on a fact the reporter doesn't export yet.
- Grouping runs by topic or by handoff chain: a later slice.
- A timed diagram. The graph shows order and what ran side by side, never duration. The reporter does export a step's start and end where it can tie the step to its dispatch; the dashboard doesn't read them yet, and drawing time is a later question.
- Pan, zoom, or dragging in the graph.

## Anti-goals

- Text that explains how to read the graph, where the drawing could say it.
- A graph that scrolls sideways, or one scaled down until its text shrinks.
- A fact parsed in this repo that the reporter doesn't export. A new fact is a change request to the workflow repo.
- Real data in a fixture, story, capture or test.
- Colour alone carrying a state: every orange, amber or green mark comes with a word, a count or an icon.

## Constraints

- `CLAUDE.md`'s data rules hold: the page's response is built by `runView` in `packages/server/src/views/runs.ts`, masked there under showing mode, and checked with `leaks`; the route only reads the database and calls it.
- No new dependency (see Approaches).
- Tokens only from `packages/web/src/index.css`; page structure from `components/Panel.tsx`; formatting from `lib/format.ts`.
- Every new or changed component has its stories (empty and full; loading and error where it fetches), and a story with an interaction test is the UI's failing test.
- The run page's Playwright baselines (`e2e/runs.screens.ts`) change in light and dark and are regenerated in the container.
- The UI slice's part 2 (the screens, branch `claude/ui-slice-screens`) is being built in another session and is not merged. It rewrites today's `RunPage`, `FindingsTable` and `RunTimeline`, adds shared components and changes conventions. This slice replaces that page, so it is built on `main` once part 2 has merged, and its plan is written against part 2's merged code: where this spec names a component or a formatter as existing, the plan uses part 2's version of it, and where part 2 has a component for a role (a section, an option switch), the plan uses that one. The mock was built on `main` before part 2.

## Approaches

**How the graph is drawn.** The owner picked A, after asking for a look at other libraries.

- **A. Our own layout (picked).** One pure function turns the run's steps into positions for the graph's three shapes; lines are SVG paths, boxes are HTML buttons. The layout is unit-tested shape by shape, focus order and axe work as on any page, and the panel takes the graph's own height at the text's real size. Cost: we own the line-drawing code (about 250 lines in the mock).
- **B. React Flow**, the project's diagram library (Home's workflow diagram). It doesn't place nodes: Home computes its positions by hand, so A's layout function is needed anyway, plus three custom edge types, a container height set by hand, clicks switched back on, and its attribution mark in the panel. What it adds is pan and zoom, which this graph rules out.
- **C. A layout engine** (dagre, d3-dag, elkjs), with or without React Flow. These place general graphs; none wraps into rows or stands up by width, and a run is a sequence with side-by-side groups, simpler than what they solve.
- Also looked at and set aside: diagram editors (JointJS, jsPlumb, Reaflow, and the commercial GoJS and ReGraph), which draw their own nodes and assume pan and zoom; Cytoscape.js, which draws on a canvas, so boxes aren't HTML; Mermaid, which chooses the layout and styling itself. This rests on what each library is built to do and two web searches, not on a prototype.

Home's diagram keeps React Flow.

**How the design was shown.** A throwaway build on the real components, on the local branch `claude/run-page-mock` (worktree `../cwd-run-page-mock`), served on fixtures with a mock-only response field. The owner chose every drawing from it. As in the UI slice, **the mock is a reference, ported under tests, never merged**: its files are readable with `git show claude/run-page-mock:<path>` once committed there, the spec and the captures win over its code, and ported code is judged as new code.

## The page, top to bottom

```
feature/offline-sync                                   (page title: the branch)
┌ Header ─────────────────────────────────────────────────────────────┐
│ Project  Path  Stage  Time  Est. cost  Tasks  Findings  Closed      │
│ Stops  Warnings                                                     │
│ [Plan run] → [This run, full · in session …] → [1 later fix commit] │
└─────────────────────────────────────────────────────────────────────┘
┌ Flow ───────────────────────────────────────────────────────────────┐
│  the graph                                                          │
│  ─────────────────────────────────────────────────────────────────  │
│  the selected step's detail, or the hint                            │
└─────────────────────────────────────────────────────────────────────┘
⚠ Problems (12)   Severity [All]  Outcome [All]
▌ table, amber side
👍 Strengths (3)
▌ table, green side
┌ Left for later ┐
┌ Warnings ┐                      (only when the run has any)
▸ Cost, context and skills        (folded)
```

Removed from today's page: the Agents table, the Skills and sweeps panel and the timeline list (`RunTimeline`).

## Decisions the owner made

### The graph

- **The unit is the run, drawn as a graph.** A box is one review with its fix rounds: a task's review, a wave's check, the plan's simplify and review, Simplify, the final review, a kit review. "Started" and "Record written" are pills at the two ends, each with its time.
- **A box** shows three lines: its name ("Task 4", "Wave A check", "Final review"), its reviewer (the agent, or "in the session"), and "Found N".
- **Parallel work is drawn, never written.** A wave's tasks sit side by side; the line forks into them and merges out of them.
- **A fix loop is an arc** over its box, labelled with the agent that ran the checks and the number of rounds ("fix-checker ×2"). Green when the last round left nothing open; orange, with the box's border, when it did.
- **What a step left leaves the line**: one dashed edge per outcome to a chip under the box ("Deferred 1", "Declined 1", "Ruled 1", "To owner 2", "Open 1", "No outcome 1"). Open and No outcome are in the warning ink; the others are muted. Fixed and applied findings have no chip.
- **A graph that doesn't fit wraps into rows** on a wide screen. A row's last edge runs to the panel's side and fades out; it fades back in at the left of the row below. Fade only, no motion. Rejected: a drawn return line, lettered connectors, a snake that reverses every other row, moving dashes.
- **Merge conflicts** show where a wave's lines join: a short single edge after the merge carries a muted "2 conflicts", only when the count isn't zero. Muted, since a resolved conflict needs no attention.
- **A task with a kit review is two boxes** side by side, "Task 7" and "Task 7 kit review", forking and merging like a small wave, each with its own reviewer, count, loop and chips.
- **Lanes and Tracks**, two other drawings, are dropped; the graph is the page's only drawing.

### The selected step

- Pressing a box selects it (pressing it again, or Close, clears it). The box shows the focus ring colour as its selected outline.
- **Its detail opens under the graph**, in the Flow panel: a title row with the step's name and a "Close" pill at its right, then **one line per finding**. Columns: the finding (id, severity, summary); the review, headed by its kind with the reviewer, model and effort; one column per fix round, headed "Fix round N" with who checked and on what model; "Ended". Each line carries a mark per column it reached, joined by a rule: "Found", then "Still open" or "Fixed" per round, then a chip with the outcome and, under it, the reason when there is one. A finding that skipped the rounds has a dashed rule across them.
- **The hint stays**: with nothing selected the strip under the graph reads "Select a task or a review to see its rounds, and its findings below." The owner removed it under show-don't-tell and brought it back: nothing drawn says a box opens a detail.
- **Problems, Strengths and Left for later follow the selection.** With a step selected they hold only its rows.
- **No Step filter above the tables.** A select listing the steps was tried and removed as redundant with the graph and misplaced.
- **When the detail opens off screen, the page scrolls to it** (its title row comes into view; instant under reduced motion). Closing doesn't scroll.

### Findings

- **Two tables**, each under its own section title with an icon and a count: "Problems (12)" with a warning triangle in amber, "Strengths (3)" with a thumbs-up in green. There is no "Findings" heading above them.
- **Each table's left side carries its colour**: amber (the notice edge token) for problems, green (the success edge token) for strengths, as the container's own 4 px left border, so it follows the table's rounded corners.
- **Amber, not orange**, for problems: orange keeps meaning "needs attention" (a stuck loop, an open finding). Pink and no colour were rejected.
- **Strengths have their own five columns**: #, Step, Task, Category, Summary. The reporter gives a strength nothing else, and the app's labeller labels findings only.
- **Severity and Outcome filters sit on the Problems title row**, since only problems have them. The Step filter is gone from this page (the graph is the step filter).
- Even spacing: 24 px between the two tables and the panels around them, 12 px from a title to its table.

### The rest

- **Left for later** sits under the findings.
- **Stops** is a header fact beside Warnings, in the warning ink with its count when it isn't zero. The graph mark is issue #35.
- **Agents and their models go in the fold for now** ("Cost, context and skills"): each agent with model, effort and dispatches, not tied to a task. The fold itself, and "Cost and context folded", were approved earlier.
- **Removed as redundant text**, with the hint kept: the step detail's caption ("One line per finding: …"); "12 problems, 3 strengths" beside the old heading; "after the run, on the same code" under "1 later fix commit"; "so there was no fix round" after "found nothing".

## Calls made in the design, for the owner to check

These are the session's, not the owner's.

- **Three shapes, by the panel's measured width.** Flat (one row, left to right) when the whole graph fits. Wrapped when it doesn't and at least four boxes fit a row. Upright (top to bottom, a wave's tasks side by side, boxes narrowed to fit) below that, which is phones and narrow tablets. A wave of up to three tasks fits 375 px upright.
- **Order.** Waves and single tasks are drawn in the order the run did them: the reporter exports a run's steps in running order, so a group sits where its first step does. Today's `timeline` lists every wave first, then the loose tasks, which would draw "Wave A, Task 4, Wave B" as "Wave A, Wave B, Task 4".
- **Wrapped rows are balanced**: the fewest rows that fit, with the boxes spread evenly, so the last row is never a stub. A wave's conflict count stays on its wave's row and never starts one (the long capture still shows it starting a row).
- **A kit review with no task** (a Small run's, which covers the whole branch) sits beside the final review, forking and merging with it, as a task's kit review sits beside its task review.
- **A kit-reviewed task inside a wave** puts both its boxes in the wave's rank, next to each other.
- **In the upright shape** an edge runs straight beside an arc's label and beside the exit chips before it curves. An edge must not cross a chip or a label in any shape; the mock still crosses a chip under a three-task wave upright, which the build fixes.
- **With a step selected the titles name it**: "Problems in Task 1 (2)", "Strengths in Task 1 (1)", "Left for later in Task 1". Without the Step select, nothing else at the tables says they are filtered.
- **Left for later lists** deferred, to owner, open and no outcome. Ruled and declined were closed by a decision, so they show as chips and as Problems rows only. With nothing selected it also lists the fix commits made after the run.
- **Below 768 px the step's detail is a stacked list**: a finding, then its marks in a wrapping row, then its reason.
- **The header chain** (the same branch's other runs in time order, this run with its session, a handoff, later fix commits) was shown to the owner and never commented; it is kept. Its handoff box shows the handoff's time; it names the session handed to only when the export says which (see Data).
- **"Later fix commits" is a term, so it gets the term's tooltip.** The reporter counts as a later fix a commit whose subject starts with "fix" and that touches the run's files within 14 days after it: a sign of what the run let through. The owner asked what the chain's "1 later fix commit" meant, after its caption was removed as redundant. The box reads "1 later fix" with the dotted underline of a term (`TERM`), whose tooltip says "Commits starting with "fix" that touched this run's files in the 14 days after it."; Left for later's list of them is titled "Later fixes" with the same term. The captures still show the old label.
- **A third fix-check verdict.** The reporter's verdicts are fixed, open and "fixed, not proportionate". The step detail marks the third "Not proportionate", in the warning ink like "Still open", since the workflow counts it as open; a loop whose last round left either is orange.
- **Ruled and Declined are muted everywhere**, on the graph's chips and on the detail's "Ended" chip alike; only Open and No outcome take the warning ink, and Fixed and Applied a green edge.
- **The unknown-key message also shows for a run hidden by showing mode**, on purpose: the page must not say that a hidden run exists. A 404 isn't retried, so the message shows at once.
- **The fold** holds four panels: est. cost by phase; models and advisor, with the main session's model and effort; context, with the sweeps; skills, loaded and offered.
- **The selection is page state**, not in the URL.
- **The strengths table's Summary column** keeps a minimum width so it doesn't wrap word by word at 375 px (it does in the mock's capture); the table scrolls in its own region instead, like Problems.

## States

| Region | Empty | Loading | Error |
|---|---|---|---|
| Page | – | "Loading the run…" | "Couldn't load this run." An unknown key gets its own message, "No run with this key.", with a link to Runs; today it keeps saying "Loading the run…". |
| Flow | A run recorded before steps were logged: "Recorded before steps were logged: there is no flow to draw." No hint. | with the page | with the page |
| Step detail | A step that found nothing: "<Review> by <agent · model, effort> found nothing." | – | – |
| Problems | "The reviews found no problem in this run." / "<Step> found no problem." / before steps: "Recorded before findings were logged: this run has none to list." One line in a panel with the amber side, no table, no filters. "No findings match these filters" stays the filters' own message. | with the page | with the page |
| Strengths | "The reviewers named no strength in this run." / "…in <Step>." / before steps likewise. One line with the green side. | with the page | with the page |
| Left for later | "Nothing left: every finding was closed in this run." / "<Step> left nothing for later." | with the page | with the page |
| Fold panels | "Advisor not consulted.", "No context facts for this run.", "No skill loaded or offered." | – | – |

A plan run draws its two steps (plan simplify, plan review) as a short graph; a Small run draws Simplify and the final review. Both lie flat wherever their boxes fit whole, and stand upright otherwise: on a phone, and at 768 px beside the full-height rail.

## Behaviour by width

| | 375 px | 768 px | 1440 px |
|---|---|---|---|
| Header facts | wrap to rows | wrap | one row |
| Header chain | wraps, one box per row | wraps | one row |
| Graph, fixture run (4 tasks) | upright | upright or wrapped, by the panel's width | wrapped, 2 rows (flat without its conflict count's edge) |
| Graph, long run (12 tasks) | upright | upright or wrapped | wrapped, 2 rows |
| Step detail | stacked list | table | table |
| Problems, Strengths | scroll sideways in their own region, with the fading edge | same | Problems scrolls, Strengths fits |
| Severity, Outcome | wrap under the title | on the title row | on the title row |
| Fold panels | one column | one column | two columns |

The page itself never scrolls sideways (`e2e/shell.spec.ts` checks it).

## Screens

- `/runs/:key`, the only screen changed. For the kit's `Screens:` lines on fixtures: `/runs/97d6367dec7d9739` (a Full run with two waves), `/runs/d583c5133a67a663` (a small run with no finding), `/runs/51120289e82db399` (a plan run), `/runs/7599a116b2739d9f` (recorded before steps).
- What the captures invented in the page becomes fixtures, all invented. In the export fixture that `dev:fixtures` serves: strengths on the main run, and nothing else, so no other page's sums, tests or baselines move (the main run's wave already has one conflict). In the run page's story fixtures (`packages/web/src/test/`): the twelve-task run with three waves, a task with a kit review and a kit fix-check (a `kit_review` step and a fix-check, both with `kit` set and `agent: kit-reviewer`), a "not proportionate" verdict, and a run with a stop. If the plan finds a case that only a served screen can check, it adds it to the export fixture and lists every other baseline and test that moves.

Approved captures, in `docs/design/2026-11-16-run-page/`, each at 1440 and 375 px, light and dark: `run-*` (the fixture run), `run-step-*` (Wave A check selected), `run-long-*` (the twelve-task run, with a conflict count and a kit-reviewed task). In them, "model not known" under a fix round is the mock's data falling short, not the design: the real page shows the model each step ran on. The Problems table and the header under `run-long-*` are the fixture run's; only the graph is the long run's.

## Data

Nothing new is parsed from the run log or the transcripts. Everything the page draws is in the reporter's export, with one exception (the session handed to) and one addition to the fields the schema keeps (a step's dispatch). `RunResponse` and `runView` change:

| The page shows | From the stored run | Showing mode |
|---|---|---|
| A step's model and effort | the model its dispatch ran on: the reporter ties a step to its dispatch (the step's `agent_id`, the dispatch's `id` and `step`), fields `report.ts` strips today and now keeps; with no dispatch tied, the step's own `model` and `effort`, the alias it was asked for | names masked as Models' are |
| A step's kit | the step's `kit` | masked like any name |
| A wave's conflicts | `waves[].conflicts` | a count |
| Groups in plan order | the tasks' numbers | – |
| Stops | `facts.stops` (already there) | a count |
| The run's session (title, id) | the session whose `file` is the run's `window.transcript`, through `sessionFacts` | as Sessions shows it; left out unless `showSession` holds |
| Handed off, with its time | `context.handoff` | – |
| The session handed to | `context.handoff_to`, a field the schema reserves for a change request the reporter hasn't shipped (CR15): only invented fixtures carry it, so the name shows when present and is absent on real data | as the run's session |
| The branch's other runs (key, path, finished) | stored runs with the same project root and branch | only this project's, so shown with the run |
| Offers | `offers` | skill names masked |
| Later fix commits (date, subject) | `later_fixes` | subject masked with `maskText`; the sha isn't sent |
| Agents (agent, model, effort, dispatches) | `dispatches`, grouped as `modelSums` names them | masked as Models' are |
| The main session's model and effort | the run's `main` | masked |
| Est. cost by phase | `phases`, named through `phaseLabel` | as Spend masks them |
| Strengths under a selected step | each strength's step, task and wave | – |

The timeline's steps gain their model, effort and `kit`; a wave group gains `conflicts`; a finding's verdicts keep the reporter's three values. The view's tests check every new field with `leaks`. The plan confirms the dispatch fields' names against the reporter's `--schema` before relying on them.

## Components

Looked up in the catalog (Storybook) first.

| Component | Status |
|---|---|
| `PageTitle`, `Panel`, `SectionTitle`, `Pairs`, `Details`, `State` (`components/Panel.tsx`) | existing |
| `Num`, `Text` (`components/Num.tsx`), `SessionChip`, `WarningText`, `Time` | existing |
| shadcn `Table`, `Button`, `Tooltip` | existing |
| `FindingsTable` (`runs/FindingsTable.tsx`) | adapted: takes a title for its filter row, the filters to leave out, and its container's classes; the Findings page uses it unchanged |
| Run header | adapted from today's `RunPage` header: gains Stops and the chain |
| Run graph (`RunFlow`: the layout function and its drawing) | new: no existing component draws a graph that forks, loops and wraps; Home's `WorkflowDiagram` is a single row of counts |
| Step detail | new: a line per finding across rounds; no table in the catalog has marks joined by rules |
| Strengths table | new, on shadcn `Table`: five columns of its own |
| Left for later | new, on `Panel` and shadcn `Table` |
| `RunTimeline` | removed with its stories |

New tokens or formatters, if the build needs them (the outcome labels "Deferred", "To owner"…, the conflict count's plural), go in `index.css` and `lib/format.ts`, not in the components.

## Conventions

Added with this spec, the owner's rule:

- `DESIGN.md`, under Do's and Don'ts: **Show, don't tell.** Text that explains how to read a screen is allowed only after checking that it is necessary, not redundant with what is drawn, and not covering for a design gap.
- `CLAUDE.md`, under Design conventions: the same rule in one line, pointing at `DESIGN.md`.

For the plan to add under `## Code conventions` once built: the run graph's positions come only from its one pure layout function (flat, wrapped, upright), drawn with SVG paths and HTML buttons, and React Flow stays Home's diagram; the stack line on React Flow says so; a problems table's side is amber and a strengths table's green, as the container's own left border; the selected step is the one filter of the run page's tables.

## Change requests for the workflow repo

This repo never edits the workflow repo; these are requests.

1. **An implementer dispatch's task, wave and round.** Reviews and fix-checks are already tied to their dispatch; implementers aren't, so a task's box can't name who built it, and lanes by agent aren't possible.
2. **Each stop's step** (step kind, task or wave, round), so the graph can mark where a run stopped (issue #35).
3. **Where a deferred finding went** (an issue, a later run), so Left for later can link to it.
4. **The sweeps as a list** (what each looked up, inline or delegated), where the page has only two counts.
5. **The session a run handed off to** (CR15, already proposed), so the header chain can name and link it.
6. **The ui kit carries show-don't-tell**: a line in its reviewer's checklist, and a point in its design file that a spec justifies each piece of explanatory text.

## Left to the builder

- The layout function's internals and its constants (box size, gaps, the wrap's side margin), within the captures.
- How the fade is drawn (the mock uses an SVG gradient on a straight run).
- The step detail's markup, as long as it reads as a table to a screen reader at 768 px and up.
- The graph's accessible structure: the mock is a `group` named "The run's flow" holding buttons with `aria-pressed`, the lines hidden from assistive tech; the build keeps every drawn fact (rounds, chips, conflicts) reachable as text.
- The fixtures' invented names and numbers.
