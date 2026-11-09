# Live workflow dashboard: design

Started 2026-11-09. **Status: slice 1 approved by the owner on 2026-11-09 and merged; slice 2 approved by the owner on 2026-11-09, after a grill; later slices open.** This is also the running record of the design: each session adds its decisions to the record and ends with the open questions.

## Intent

The owner runs an agentic workflow for Claude Code (`shoklah/claude-workflow`, exported publicly as `shoklah/claude-workflow-template`). Its reporter, `scripts/workflow-report.py`, reads the run log and the session transcripts on the owner's machine and prints what happened: runs, steps, findings and what became of them, models, advisor use, tokens and estimated cost, health warnings. Today the only view is a static page, rebuilt and republished as a private claude.ai artifact by hand with `/workflow-dashboard`.

This project makes that view live, and makes it something the owner can show to people they pick. It is also a personal playground and a portfolio piece, so the repo is public and holds no personal data.

## What exists today

- `workflow-report.py --json` prints one JSON object with a `version` (adding keys keeps it; renaming or removing a key bumps it): `runs`, `sessions` (main sessions with no run record), `totals` (scoreboard, weeks, skills, models, advisor, health). `--schema` documents the run record. `--brief` and `--health` print the warnings. `--html` writes the static page.
- A run reaches the reporter only when its record is appended to `~/.claude/workflow-log.jsonl`, at the end of the run. Nothing in the JSON describes a run still in progress.
- The reporter reads the transcripts, so it runs only on the machine that holds them.
- On the owner's machine, `--json` takes about 20 to 30 s, and `--since` a week ago saves only about a quarter of it: most of the time goes on recent transcripts, not history.
- The public template is behind the private repo: it has no `--json` and no `--html` yet.
- The workflow repo's 2026-11-08 dashboard design planned a "part two": a live app on the owner's home server, reachable only from the home network and VPN.

## Goals

- See the workflow's state live on the Mac without running a command: a finished run shows within about 30 s.
- Assess the workflow: what each step ran, found and what became of each finding, week over week, and whether the workflow was followed.
- Show it to people the owner picks, on the owner's screen, and later as scoped snapshots.
- A public repo with no personal data, which works as a portfolio piece and as the testbed for the workflow's design focus.

## Non-goals, for now

- Parsing transcripts or the run log here: the reporter does that.
- Remote and phone access (slice 4); snapshots, monitoring sessions as they run, a public demo (later).
- Logins and more than one user.
- A native app.

## Anti-goals

This fails, even if it works, if:

- Real data reaches the repo, the fixtures, CI, a screenshot or anything public.
- The app and the reporter disagree on a fact, or the app's labels pass for the reporter's facts.
- The labeller spends past its cap, or sends anything but finding text.
- Another website can read the local server's data or drive it.
- Stored history goes stale without saying so, or a migration loses data that can't be rebuilt.
- The playground never ships: slice 1 ends with the live home working on the owner's real data.

## Constraints

- The reporter is the installed copy, JSON version 1, about 20 to 30 s per export, and it runs only on the Mac, as `/usr/bin/python3 -I <path> --json`.
- The workflow applies in full: the Full path, TDD with the failing-test check, task and final reviews. Two parts are risk areas: the local server's request checks, and any migration of stored data.
- Personal data lives only in `~/Library/Application Support/claude-workflow-dashboard/`, outside every repo.
- From slice 2, the labeller sends finding text, never code, from the Mac to the Anthropic API, with the owner's own key.

## Approaches considered

| Question | Considered | Picked |
|---|---|---|
| Form | native Mac app; local server; home server; one static file everywhere | local server first, home server in slice 4. Native dropped (no gain beyond practice); one file dropped for the live page (a reload loses what's open, no refresh button) |
| Reporter | installed copy; pinned template or submodule | installed copy: a second copy could disagree with the one the workflow runs |
| Fixtures | hand-written only; generated from invented transcripts; one loader over both fixtures and real output | one loader: catches drift without putting transcript knowledge here |
| Showing it | on the owner's screen; scoped snapshot; live access behind a login | the owner's screen now, scoped snapshots later, no login access |
| Only what changed | computed at load from full exports; an incremental export in the reporter | the incremental export (CR6) is the target; slice 1 loads full exports by key, so CR6 changes nothing visible |
| Stack | Python backend with React; TypeScript end to end; Django with Next.js | TypeScript end to end: one set of types from import to charts |
| Home | workflow first; numbers first; what's new first | the numbers on top, the workflow in the middle, the feed on the side |
| One run | timeline; tabs; findings first | the timeline, with the findings table as a toggle |
| Who judges a finding's category and relevance | the workflow at review time; the app after import, with a model; the owner by hand on the run page | both machines: the workflow's label is the fact, the app's is a second opinion that also covers past runs. The owner's hand mark stays a later override if self-grading proves soft |
| How the app calls a model | the API with its own key; the Claude plan through `claude -p`; no model at all | the API with its own key: billed apart from the plan's weekly limits, and no Claude Code prompt riding on every call |
| The Findings page | table first, one row per category; heatmap first, category by week | heatmap first |
| Slice 2's cut | findings first, in two parts; the static page's sections first; one slice | findings first: 2a is findings and showing mode, 2b the static page's sections, Compliance, Sessions and Home's skills section. Basics first leaves the gap the owner named open longest; one slice is about 18 tasks behind one review |

## Slice 1 design

**Parts.** A pnpm workspace:
- `shared`: the zod schemas for the fields of the reporter's JSON the app reads (the loader of decision 13), and the API's types.
- `server`: Hono on Node, listening on 127.0.0.1. It runs the import and serves the API and the built `web`.
- `web`: the React single-page app.
- A command in the repo installs and removes a launchd agent that starts `server` at login.

**Import.**
1. A trigger (server start, `~/.claude/workflow-log.jsonl` changed, the 15-minute timer when a transcript changed, the refresh button) runs the reporter with a timeout. One import runs at a time; a trigger during one queues a single follow-up.
2. The loader checks `version` is 1 and parses the fields the app reads: a missing key is absent, an unknown key is ignored. If anything fails, the stored data stays, and the page shows a banner saying why and since when.
3. In one transaction, each run and each session is upserted by its key: its raw JSON when it changed, the derived rows the screens read, and a change entry. Each warning is stored by its exact text, linked to its run or session, with the time it was first seen. The export's `totals` are stored as the latest.
   - **Every version of a unit's raw JSON is kept,** appended, never overwritten.
   - **A null never replaces a value read earlier.** In the reporter's JSON, null means it couldn't read the fact (for example once Claude Code cleans up a transcript), not that the fact changed.
   - **A unit missing from a full export is marked** as not in the latest export, with the time, and never deleted. A session that leaves `sessions` because a run now covers its transcript is linked to that run, through the run's window, computed when slice 2 needs it (decision 32).
   - **The first import is a baseline:** everything it brings counts as seen, so the feed starts empty.
4. Every derived row can be rebuilt from the raw JSON, so a migration never loses data.
5. **Where the data is trimmed:** the raw JSON is stored in full, on the Mac only, so nothing is lost and everything can be rebuilt. Keeping only the fields the page shows (decision 13) and the scope filter (decision 14) happen between the database and what leaves the backend: the API, and later the snapshot. The frontend never receives a field it doesn't show.

**What the screens read.**
- **Home's numbers and the weekly charts** are plain sums over the stored runs, each sum's definition written next to it. The local check compares them with the reporter's `totals` for the weeks the reporter still fully covers; older weeks may hold more in the app, and the page says from when the reporter's coverage starts.
- **Findings** are every finding recorded in any step (reviews, plan review, plan simplify's cuts and flags, `simplify`'s fixes), split into acted on (`fixed`, `applied`), not acted on (`declined`, `deferred`, `ruled`, `to_owner`) and `open`. The tile reads "19 findings · 13 acted on · 1 open". The reporter's weekly findings, which are the final review's only, appear under that name on the Weeks page in slice 2.
- **Warnings by week:** a run's warnings count in its run's week; a session's warning in the week it was first seen, since the reporter only reports this week's session warnings.
- **The workflow diagram** has two tabs: the Full path, plan records' steps then Full runs' steps, as in the workflow's README diagram, and the Small path. The mockup's separate Plan tab is dropped. Counts come from runs with steps (schema 2); older runs in the period are noted as "N runs before steps", since only the reporter may turn them into steps.
- **The feed:** change entries for finished runs and first-seen warnings after the "mark all seen" time. A fact that became null doesn't make an entry.
- Banners: the last successful import's time, and the last failure.

**Screens:** the home screen (decision 22), the Runs list and one run (decisions 26 and 30, the timeline untimed), mockups in `docs/design/2026-11-09-live-dashboard/`. Menu entries for later slices stay hidden until built.

**Server rules** (decision 16 and Claude's calls): 127.0.0.1 only; requests whose `Host` isn't `localhost` or `127.0.0.1` on its port are refused; no CORS headers; the refresh is a POST with a custom header, checked with `Origin` when one is sent.

**Tests:** Vitest for the loader, the import and the API, on invented fixtures; Storybook stories with interaction tests for components; Playwright screenshots and axe checks on the screens with fixtures; GitHub Actions runs them all, on fixtures only. The local check of decision 13 runs the loader over the real output and prints field names only.

## Left to the builder

- The database tables, the API's shapes and the component structure.
- The port number, and how the launchd agent is installed and removed.
- Chart details within ECharts, guided by the `dataviz` skill.
- The fixture runs, as long as they cover a Full run with waves, a Small run, a plan record, a schema 1 record, null facts and a failing reporter.
- Each run's key across exports: to confirm against the reporter's output (a record's `date` looks unique; old records unconfirmed). If no stable key exists, that's a change request (CR7), and the plan stops there.

## Slice 2 design

Two parts, each with its own plan and pull request (decision 43):
- **2a:** findings assessment and showing mode.
- **2b:** the static page's sections, Compliance, Sessions and Home's skills section.

The mockups are in `docs/design/2026-11-09-slice-2/`: the Findings page uses layout B (`findings.html`), plus `sessions.html` and `basics-and-showing.html`. The look of the basics pages is not settled (decision 42).

**Why.** Slice 1 counts the findings raised and closed. It can't say:
- whether a finding mattered
- whether the session applied the right ones
- what the plan and the implementation do well and badly

That is the gap the owner named first (decision 35). The rest of slice 2 is decision 20's basics and the Sessions page; the static page covers them meanwhile.

### 2a. Findings assessment

This section describes where findings assessment ends up. What 2a itself builds and what lands later:
- **2a builds:**
  - the category list
  - the app's labeller and its stored labels
  - the key's env file
  - the Findings page, with every label the app's
  - the run page's Category and App columns, with Valid showing "–"
  - showing mode
  - drafts of CR10 to CR12 in this spec
- **Lands with CR10, as its own task from the workflow's real output:**
  - workflow labels winning over the app's
  - the Valid column's values
  - strengths
  - the "app differs" measure
  - the exported list replacing the one in `packages/shared`

**Labels.** Every finding gets a category from one fixed list, by area, and a relevance call: valid, invalid or unclear.
- **The area comes from the step,** with no new field:
  - plan simplify and plan review are the plan
  - task reviews, wave checks and the final review are the implementation
  - simplify is cleanup, labelled from the implementation list
- **The list** (a draft, decision 37):
  - Plan: scope (missing or extra work), task split and order, spec gap, risk missed, test plan.
  - Implementation: correctness, error handling, data safety, security and privacy, reuse and duplication, conventions, simplicity (over-building), tests, naming and clarity, performance, docs.

  The list carries a version. It lives in `packages/shared` until the reporter exports the workflow's list (CR10); then the exported list replaces it.
- **Two judges** (decision 36):
  - **The workflow's labels** are facts from the reporter, once CR10 lands: the reviewer's category, the session's valid, invalid or unclear when it applies, declines or rules the finding, and the reviewers' strengths.
  - **The app's labeller** labels every finding, past and new. On a finding the workflow labelled, its call shows only where it differs, as the app's second opinion. On any other finding it is the only label, marked as the app's.

**The labeller.**
- **When:** after each successful import, as a job on `createQueue`. It labels each finding that has no app label for the current list version, about 25 findings per request, up to the day's cap.
- **Input per finding:** the step kind, the severity (or plan simplify's kind), summary, outcome, reason and fix-check verdicts. Never code, and never the run's files. Each text goes through `trimPaths` before it leaves the Mac.
- **Output per finding:** a category from the area's list, valid, invalid or unclear, and a reason of at most one sentence. Structured output rejects a reply outside the list; it is never stored.
- **Model:** Claude Haiku 5.5 by default, set in the env file. It uses plain Messages API calls; the Batch API's discount is worth cents here.
- **Cap:** a daily count of findings, set in the env file, 500 by default, so labelling past runs takes a day or two. The page shows how many findings are labelled, how many are waiting, and the tokens the labeller used this week.
- **No key:** labelling is off, the Findings page says so in one line, and everything else works. CI, `dev:fixtures` and every test run with no key; the client is injected and stubbed.
- **Labels are stored facts.**
  - Each label is keyed by run key, finding id, a hash of its input text, the list's version and the model, and stored with the time and its one-sentence reason.
  - Labels can't be rebuilt from `unit_versions`, so a migration carries them over, as it does `missing_since`.
  - A finding gets labelled again when its text changes, the list gets a new version, or `LABELLER_MODEL` changes. Switching to a stronger model is how a doubtful labeller gets upgraded, with no code change. Old labels stay stored. After a model change, the old model's label shows until the new model's replaces it (decision 49).
  - Each app call's reason shows in the cell's findings list, so judging a pattern means reading the reasons behind it.
- **Cost:** about 230 input and 150 output tokens per finding, at list prices on 2026-11-09. With about 250 findings in a busy week, Haiku 5.5 costs about $0.03 a week, and about $0.10 to label every finding already stored. The Anthropic workspace's spend limit is the hard ceiling (below).

**The key** (decision 38).
- `ANTHROPIC_API_KEY`, `LABELLER_MODEL` and `LABELLER_DAILY_MAX` live in `.env` in the data folder, mode 0600. Node's `process.loadEnvFile` loads it at start, and the SDK reads the key itself.
- `.env.example` in the repo names these variables, with no values.
- The key never appears in the repo, a fixture, a log or an error text.
- The owner makes a dedicated key in its own Console workspace with a monthly spend limit, the hard ceiling on cost.

**The Findings page,** a menu entry after Runs, layout B:
- **The grid:** categories down, weeks across, over a period chosen as on the Runs list. One blue ramp, with the number in each cell.
  - A measure switch: raised, share acted on, share judged invalid, app differs.
  - An area switch: plan, implementation, cleanup.
  - Path and project filters.
  - An "unlabelled" row while labels are missing.
- **A cell** opens its findings below the grid. Each shows its summary, its run (project · branch, linking to the run), step, outcome, the workflow's valid call, and the app's label and call.
- **A side panel** shows the period's relevance signals, all sums over the stored runs:
  - fix commits within 14 days after a run (`later_fixes`)
  - final-review findings on runs whose task reviews came back clean
  - fix-check verdicts of "fixed, not proportionate"
  - declined or ruled findings, and, after CR10, how many the session judged invalid
- **Strengths** by category become a measure of their own after CR10.
- **Counting:** a finding counts in its run's week (`weekOf` on the run's finish time). Acted on and not acted on mean what slice 1 defines.
- **Which judge a count uses.** A category or relevance count uses the workflow's call where one exists, otherwise the app's (decision 36: the app's is the only label on past runs). Until CR10 every label is the app's, so one line on the page says so, and an aggregate never passes for the reporter's facts (decision 49). The per-cell split ("7 · 5 by the app") and "App differs" come with CR10's task.
- **2a reads no CR10 field.** Its shape is still a draft, and fixtures that guess it could drift from the real output. Until CR10:
  - the Valid column shows "–"
  - no strengths show
  - every label is the app's

  Reading CR10's fields is its own task once the workflow ships it, built from its real output.

**One run's findings table** gains three columns:
- **Category:** the workflow's, otherwise the app's, marked as the app's.
- **Valid:** the workflow's call, "–" before CR10.
- **App:** "agrees", or the app's differing call.

After CR10, the table also lists the reviewers' strengths.

### 2a. Showing mode

- **Turning it on:**
  - A switch in the header opens a picker of the stored projects. The owner ticks the ones to show and starts.
  - The server holds the mode and the picked projects in `state`, so the mode survives a restart and filters every response, not just the page that's open.
  - Starting and stopping are POSTs under `createApp`'s request rules, like the refresh.
- **A picked project** shows in full detail under its alias, or under its folder name when it has none. Aliases live in `config.json` in the data folder. Costs and the Fable and all-model points stay visible (decision 40).
- **Everything else:**
  - Other projects appear only in sums (tiles, charts, totals), plus one line where their rows would be ("+ 5 runs in other projects").
  - No response carries an absolute path or a session ID. Session chips drop their ID and copy button. Warning and finding texts go through `trimPaths` and lose session file names.
  - The feed keeps only picked projects' items, and filter lists offer only picked projects.
- **Where it applies:** each view takes the scope and applies it through one shared helper; a route never filters. Each view's tests run a leak check: with showing mode on, the serialized response holds no hidden project's name, path or branch, and no session ID from the fixtures.
- **Checked on real data too.** The fixtures' leak check passes by construction, so `check:real` adds a showing-mode leak check on the stored data:
  - it picks one stored project and builds every page's response with showing mode on
  - it checks that no other project's path or folder name, and no session ID, appears in any of them
  - it prints pass or fail and a count, never a value
- **What a project is.**
  - A project is its full path. Two projects can share a folder name, so a name alone would leak one when the other is picked.
  - A worktree under `<repo>/.claude/worktrees/<name>` folds into `<repo>`.
  - The API carries a project key, a hash like the run keys, never the path.
  - A project shows as its alias, otherwise its folder name, with the parent folder added when two shown projects share a name.
  - This changes slice 1's `project` fact (today the last path segment) and the Runs list's project filter (today by name) to the key, as part of 2a.
- **A session's project** (for 2b; decision 49): the reporter doesn't give one. In 2a, showing mode leaves out every session warning, which fails closed. Until CR11, the app encodes each stored project's path the way Claude Code names transcript folders.
  - A session belongs to a project when its folder equals that encoding, or starts with the encoding followed by `--claude-worktrees-`, and exactly one project matches.
  - With no match, or more than one, it is "other project" and stays hidden in showing mode, so the check fails closed.
- **Text that names a hidden project.** A picked project's finding, warning or labeller reason can name a hidden project's folder or path. In showing mode, that name is replaced with "another project". The leak-check fixtures include such a text.

### 2b. The static page's sections, Compliance, Sessions, Home's skills section

- **Steps and rules, Weeks, Skills, Models and advisor:** the static page's tables, each with a period.
  - A figure that is a sum over runs and sessions is summed from the stored ones. On a full export, `check:real` compares each new sum with the reporter's totals, as it does for `weekSums`.
  - Some figures aren't sums over runs and sessions yet: dispatch-guard refusals; the advisor's calls by role, failed calls, tokens and weekly Fable share; startup counts; typed-trigger misses in run windows; the stage table. These show the latest export's totals, marked "reporter, all time", until CR12 moves them into runs and sessions.
  - Weeks adds four small multiples, one measure each: runs, final-review findings, cost, minutes per run.
  - The tables ship working but plain; their readability is a later UX/UI slice (decision 42).
- **Compliance** (decision 48).
  - **If PR #8 is installed when 2b's plan is written:**
    - warnings are grouped by kind (CR4's `warnings` objects), with a weekly trend per kind
    - each group opens onto the runs and sessions behind it
    - Home's step boxes turn orange when a warning is attached to that step
    - a kind the dashboard doesn't know shows as "other"
  - **Otherwise:** Health's warnings, grouped as the static page groups them: each run, each session, other, information.
  - **In showing mode,** either way, only picked projects' warnings show.
- **Sessions:** one row per session, showing:
  - its name (decision 31) and project (as above), and when it was first seen
  - the skills it loaded, and the skill commands typed, marked when the skill never loaded
  - model and effort, estimated cost, startup guidelines, warnings

  A session that a run now covers links to that run: its file is the run's window transcript (decision 32). A row opens the session's skill loads and typed commands in time order. Once CR9 is installed, it shows the session's title in place of its ID's first characters. After CR11 it also shows start and end, the reporter's project and every slash command.
- **A session's time,** for periods and sums:
  - its start, once CR11 exports one
  - until then, its earliest skill load or typed command
  - otherwise, its first-seen time, which puts sessions with no activity from before the first import in that import's week

  A session that a run now covers counts with its run, not as a session, as the reporter counts it. The Sessions page lists it with its link, behind a filter.
- **Home's skills and commands section,** below the charts. For each skill or command:
  - the share of the period's sessions that loaded it, as a bar
  - how many runs loaded it
  - how often it was typed, and how often typed but never loaded

### Left to the builder (slice 2)

- The labels table's columns, the labeller's prompt and its output schema, and how the queue orders labelling after an import.
- The API shapes, the scope helper's name and signature, and the picker's components.
- The heatmap: a table with coloured cells, which is its own table view, or an ECharts heatmap under the chart conventions. The `dataviz` skill decides the ramp's steps.
- The fixtures, as long as they cover:
  - findings in every area, labelled and unlabelled
  - a finding whose text changes between exports
  - sessions in a run's project and in none
  - warnings holding a session file name
  - at least two projects, for the leak checks
- Which reporter fields `report.ts` adds (`offers`, the totals 2b reads), under its convention.

## Decision record

Each session's decisions, in the order they were made. Later decisions can replace earlier ones; each says so.

### 2026-11-09, the owner

1. **Own repo, public:** `shoklah/claude-workflow-dashboard`. It holds code and invented data only; the real data is read at run time on the owner's machine. It depends on the public template's reporter.
2. **The Mac first, the home server next.** The first slice runs on the owner's Mac. The next one adds the home server, the 2026-11-08 design's part two, reachable only from the home network and VPN, which also gives phone access. Either way the reporter runs on the Mac, where the transcripts are.
3. **No native app.** A native Mac app was considered and dropped: it brings nothing beyond native development practice, and would need a second UI for anything shown in a browser.
4. **Playground boundary:** the frontend is free ground for trying things; everything that touches the data follows the workflow's rules. Recorded in `CLAUDE.md`. (Widened by decision 24.)
5. **"Showing it" means real data to people the owner picks,** not a public demo, in two ways: the owner shows the live page on their own screen, in person or on a call, and sends a snapshot as a private claude.ai artifact shared with named people. Live access for those people on their own, behind a login, isn't planned.
6. **A public demo** with invented data and a landing page comes later, after the UX/UI design step on the workflow's roadmap.
7. **Ongoing sessions:** tracking and visualizing sessions still in progress is a nice to have. Its design and cost are to be assessed.
8. **The reporter stays the only parser.** A new fact the dashboard needs goes to the workflow repo as a change request.
9. **First slice, as proposed:** an overview (this week against last: runs by path, findings raised and closed per step, estimated cost, warning count), weekly trend charts (runs, findings by step and outcome, cost, advisor share, time per run), the runs list opening to steps, findings and waves, and a page that rebuilds when a run finishes. The same file is the snapshot. Ongoing sessions, the home server and the detailed skills, models and advisor tables come later; today's `--html` page keeps them meanwhile. (The last sentence's tables are replaced by decision 20; the slice cut is open again.)
10. **A monitoring and assessment tool,** for the workflow and for sessions: a proper visualization of the workflow, whether it was followed, which skills and processes ran, and inconsistencies such as skills not triggering or triggering too often.
11. **Assessment first.** Slice 1 is decision 9 plus a compliance view built on structured warnings (CR4), grouped by kind with a weekly trend, and a fixed workflow diagram carrying each step's counts from the scoreboard. Monitoring sessions as they run comes in a later slice and needs CR3. (Which slice holds what is replaced by decision 23: the compliance view moves to slice 3.)
12. **The installed reporter at run time:** `~/.claude/scripts/workflow-report.py`, its path configurable. No submodule and no pinned second copy. Same version with new keys: unknown keys are ignored and a missing key reads as absent. An unknown version, or a reporter that fails or times out: the last good page stays, with a banner saying why. The dashboard never guesses.
13. **One loader, two inputs.** One loading step checks the version, treats a missing key as absent and keeps only the fields the page shows (the slice 1 design places this trimming between the database and the API, after the full raw JSON is stored). CI runs it over invented fixtures. A local-only command runs it over the real output and prints only the dashboard's own field names that didn't match, never a value. It runs before each release and when the reporter changes.
14. **Snapshots are scoped per share.** The owner picks the projects a snapshot covers: those get full detail, every other project appears only in totals and charts. No snapshot carries absolute paths or session IDs; a project shows under a name from an alias file in the owner's local config, outside the repo. With no project picked, a snapshot is totals only. The filter runs before anything leaves the backend (the slice 1 design, import step 5), so what's left out is never sent or embedded. The live page has the same filter as a "showing" mode for calls. To verify in planning: who a claude.ai artifact can be shared with.
15. **Refresh triggers:** a rebuild when `workflow-log.jsonl` changes, so a finished run shows within about 30 s; a timer every 15 minutes for session-level facts, skipped when no transcript changed since the last build; a "refresh now" button on the live page. Nothing runs while the Mac sleeps. Anything fresher belongs to the monitoring slice and CR3, not to a faster timer.
16. **A local server for the live page.** The process that runs the triggers also serves the page and its data on the Mac; the page updates in place, so nothing open is lost, and the refresh button asks that process to rebuild. A snapshot is the same frontend built with its data embedded, one file. The server, from the start: listens on 127.0.0.1 only; refuses any request whose `Host` isn't `localhost` or `127.0.0.1` on its own port (against DNS rebinding); sends no CORS headers; triggers a rebuild only on POST. This is a risk area under the workflow.
17. **Two tools, two steps of one workflow.** The static page in the workflow repo (`--html`, `/workflow-dashboard`) stays a synthetic summary of what happened. This app is the more advanced way to visualize, monitor and assess it, and may show what the static page doesn't. Each export loads only what changed since the last one into a database, and everything that reaches the frontend goes through backend processing first, where the advanced analyses live.
18. **Facts agree, analysis may differ.** The app never re-derives a fact the reporter already reports (counts, costs, whether a step or skill ran), so on facts the two never disagree. On top of those facts, the app may make judgments the reporter doesn't.
19. **The exporter becomes incremental (CR6).** The reporter exports only what changed since the last export, so neither the export nor the computing grows with history. It's a change in the workflow repo.
20. **The app shows the basics too.** Everything the static page shows also appears in the app, with the advanced layer on top: the static page ships with the workflow repo, while the app is installed separately.
21. **Start from what the app shows.** The specifics of the advanced analyses are designed in later steps.
22. **The home screen,** chosen from mockups: this week's four numbers on top (runs by path, findings and how many closed, estimated cost, warnings and how many new), each against last week; the workflow diagram in the middle, with a tab per path (Full, Small, plan), each step box carrying its counts and turning orange when a warning is attached, fix-checks as one line under it; weekly charts below (findings by step, cost, warnings); a feed on the right of what's new since the last visit (finished runs, new warnings), each item opening its detail, with "mark all seen". A menu on the left: Home, Workflow, Runs, Sessions, Compliance, Steps and rules, Skills, Models and advisor, Weeks, covering every section of the static page. On a laptop the charts sit just below the fold; a phone layout comes with the home server.
23. **The slices.** Slice 1 needs nothing from the workflow repo: it loads today's full `--json` (version 1) by updating each run and session by its key, so CR6 later only shrinks what arrives.

| Slice | Delivers | Needs from the workflow repo |
|---|---|---|
| 1. Live home | The whole stack: export, SQLite (raw JSON kept, upsert by key), backend with the `Host` checks, frontend; the refresh triggers and button; the home screen (decision 22); the Runs list and run detail. Warnings show as their text, and "new since the last visit" matches them by exact text, so no step box turns orange yet. | Nothing |
| 2. Basics and showing | Every static page section as a page (decision 20), Sessions, the scoped "showing" mode with project aliases (decision 14) | Nothing |
| 3. Compliance | The compliance view grouped by kind with a weekly trend; orange step boxes | CR4 |
| 4. Home server | The same app over the VPN, with a phone layout | Nothing |
| Later | Snapshot, monitoring live sessions, the public demo | CR3, CR5, CR1 |

CR6 can land at any point without a visible change. To check in planning: that every run has a key that stays the same across exports (a record's `date` looks unique; old records unconfirmed).

24. **Technology is free across the stack; the data rules are strict everywhere.** Frameworks, ORM and migrations, charts, styling and tooling are playground, each recorded in `CLAUDE.md` with one line on why. Privacy, facts only from the reporter, the `Host` checks, raw exports kept, TDD and the workflow's reviews hold whatever the technology.
25. **TypeScript end to end.** A Node backend and a React frontend, sharing one set of types from import validation through the API to the charts. Chosen over a Python backend (closer to the workflow repo, but two languages and generated types) and over Django with Next.js (known, so less to try, and heavy for a local single-page app).
26. **One run's screen, for now:** a timeline from start to record, waves side by side, each step opening its findings (layout A), with a toggle to every finding of the run in one filterable table (layout C). The Runs list as mocked up: filters (path, project, period, has warnings), one row per run with finish time, project and branch, path, time, tasks and waves, findings and how many closed, stops, estimated cost, warnings; a record from before steps shows "–" with a "before steps" mark.
27. **The stack is final; components, mockups and graphical libraries keep evolving.** Final: Node LTS, Hono, Drizzle over SQLite (`better-sqlite3`) with its migrations, zod, React with Vite, TanStack Query and Router, Tailwind, Vitest, Playwright, pnpm workspaces (`shared`, `server`, `web`), GitHub Actions on fixtures only. Evolving: the component kit (shadcn/ui to start), the graphical libraries (React Flow for the diagram, ECharts for charts, to start) and the mockups.
28. **This project is the testbed for the workflow's design focus.** Design processes and skills are tried here first, measured by this dashboard, and what earns its keep goes to the workflow repo as a change request.
29. **Slice 1's design practices:** mockups before the plan, the approved ones kept in `docs/design/`; Storybook stories on fixtures in every state (narrowed by decision 34), a story with an interaction test as the UI's failing test; Playwright screenshot comparisons and axe accessibility checks on fixtures, which can gate; the `dataviz` skill loaded whenever a chart is written; a `## Design conventions` section in `CLAUDE.md`. The visual review agent and a design step in the reporter wait until these have a few runs behind them.
30. **The run's timeline is untimed in slice 1.** Steps in order, grouped by wave and task, with times only at the start and the end; the run's skills, models and advisor notes are listed for the run as a whole. This replaces the step times and implementer names in decision 26's mockup. Step times and links come with CR8.
31. **Sessions on the page** (from plan review): a session shows by its name, with its full ID in a tooltip on hover and a copy button beside it. Until the reporter gives a session's title (CR9), its name is the ID's first 8 characters. Session IDs may reach the live page; snapshots still never carry them (decision 14).
32. **Stored data with no slice 1 reader** (from plan review): the link from a session to the run that later covers it is computed when slice 2's Sessions page needs it, from the stored windows and session files; the reporter's totals are stored from slice 1, for slice 2's pages.
33. **`main`:** its first commit holds `CLAUDE.md`, `.gitignore`, the spec, the slice 1 plan and the mockups, and is pushed; the empty design branch is deleted; implementation runs on its own branch, with a pull request to `main`.
34. **Story states** (from plan simplify): every component gets stories for its empty and full states; only components that fetch data also get loading and error states. This narrows decision 29's "every state".

### 2026-11-09, the owner, slice 2 design

35. **Findings assessment is slice 2's headline:**
    - whether each finding mattered, and whether the session applied the right ones
    - findings grouped by categories finer than severity, to show the plan's and the implementation's strengths and weaknesses
    - positive findings counted beside the problems
36. **Two judges for each finding.**
    - The workflow labels findings at review time (CR10).
    - The app labels them after import, with a cheaper model, through the Anthropic API and its own key.
    - The workflow's label is the fact. The app's is a second opinion, and the only label on past runs.
37. **The category list** starts as the draft in the slice 2 design and gets refined later.
38. **The API key lives in an env file:** the real one in the data folder, a template in the repo.
39. **Sessions:** the Sessions page lists each session's skills and commands, and the summary of skills and commands across sessions lives on Home.
40. **In showing mode, a guest sees** estimated costs and the Fable and all-model points.
41. **The Findings page is layout B:** category by week first.
42. **The static page's sections ship as working tables.** Making Steps and rules and Models and advisor readable waits for a UX/UI slice.
43. **Slice 2 is cut findings first:**
    - 2a: findings assessment and showing mode.
    - 2b: the static page's sections, Compliance, Sessions and Home's skills section.

    This replaces decision 23's slice 2 row. 2a still starts with nothing from the workflow repo, and CR10, CR11 and CR12 improve 2a and 2b as they land. It also adds Findings to decision 22's menu, after Runs. The Workflow entry stays hidden until slice 3.

### 2026-11-09, the owner, slice 2 grill

44. **The app outlines patterns; the owner judges them.** The owner assesses whether a pattern is pertinent and designs any fix outside the app. The Findings page shows the pattern and the findings behind it, with no export and no links to agent files.
45. **Trusting the labeller before CR10.**
    - The labeller stays on Haiku 5.5, with each call's one-sentence reason shown beside it.
    - If the reasons read wrong, switching `LABELLER_MODEL` relabels everything, with no code change.
    - Once CR10 lands, "app differs" is the standing check.
46. **Strengths meet the findings' bar:**
    - specific, and tied to the brief
    - at most three per review, categorized
    - optional, so a review can list none

    Categories of their own for strengths come later (open question 6).
47. **CR10 starts now, in parallel with 2a,** in its own session in the workflow repo.
48. **The order after 2a:**
    - **2b, if PR #8 is installed when 2b's plan is written.** [shoklah/claude-workflow#8](https://github.com/shoklah/claude-workflow/pull/8) holds CR4, CR8 and CR9. 2b's Compliance then groups warnings by kind, with a weekly trend, and Home's step boxes turn orange. Otherwise, 2b keeps the static page's grouping and these move to slice 3.
    - **Slice 3** shrinks to the Workflow page, with CR5 if it needs it.
    - **The UX/UI slice** comes right after 2b.

    This replaces decision 23's slice 3 row.

### 2026-11-09, the owner, slice 2a plan

49. **The slice 2a plan is approved** (`docs/superpowers/plans/2026-11-09-live-dashboard-slice-2a.md`), with three changes to the design:
    - Until CR10, one page line says every label is the app's, instead of a per-cell count.
    - Matching sessions to projects moves to 2b, and 2a's showing mode leaves out every session warning.
    - After a model change, the old model's labels show until the new model's replace them.

## Claude's calls, open to correction

- **One library per job at a time.** Swapping a component kit or a graphical library is its own small task, with screenshots before and after and a line in `CLAUDE.md`, so evolving never stalls a slice.
- **Where the data lives:** the database and the raw exports in `~/Library/Application Support/claude-workflow-dashboard/`, outside every repo; the app's settings (the reporter's path, later the project aliases) in a config file there too.
- **The refresh POST also needs a custom header** (and a matching `Origin` when one is sent). Another site can send a plain form POST to `127.0.0.1`, which passes the `Host` check and would trigger a rebuild; a custom header forces a preflight, which fails without CORS.
- **From the builder check (2026-11-09):** keeping every raw version, a null never replacing a known value, units marked rather than deleted, the first import as a baseline, home's numbers as sums over stored runs, the findings definition and "acted on", warnings by week, the diagram's two tabs instead of three, and schema 1 runs noted rather than counted in the diagram. All in the slice 1 design above.
- **A judgment sessions should act on during a run** is promoted to the reporter as a change request, since `--brief` is what sessions read; the app keeps the exploratory ones.
- **Loading is upsert by key, never append-only.** A run's facts keep changing after it ends (later fix commits for up to 14 days, new checks after a reporter upgrade), so the incremental export carries changed units, not only new ones, each under a stable key. Each unit's raw JSON is kept as received, and every derived table can be rebuilt from it.
- **Totals are sums over units.** With an incremental export, the app computes totals from the units it holds. To keep decision 18, every total the app shows must be a plain sum over the exported units, and a local check compares the app's totals with the reporter's on a full export. The app may hold more history than the reporter can still read; that's a difference in coverage, shown on the page, not in facts.
- **One web frontend.** The same frontend reads the real JSON locally and invented JSON in tests, screenshots and the later public demo.
- **A Mac-side job** started at login (launchd) runs the reporter. It's needed wherever the page is served, since only the Mac has the transcripts.
- **No tricks to make the export faster here.** The app stores what each export brings and never re-derives a fact; a faster export is the reporter's job (CR6).
- **Slice 2, the labeller's mechanics.**
  - Haiku 5.5 is the default model, from the owner's "a cheaper model".
  - It makes plain calls of about 25 findings each, with structured output, after each import.
  - The cap counts findings, not dollars: the app keeps no price table, since prices are the reporter's.
  - Labels are keyed by a hash of their input text and the list's version, so a change relabels by itself.
  - Labels are stored facts, carried over by migrations.
- **Slice 2, the area of a finding comes from its step,** and simplify's findings use the implementation list.
- **Slice 2, showing mode's safety:**
  - The mode lives in `state`, so it survives a restart.
  - One scope helper applies it in every view, and each view's tests run a leak check.
  - A session's project comes from matching its transcript folder against stored run projects. A session that matches none is hidden, so the check fails closed.
  - Compliance hides the "other" and "information" groups while showing, since they can name anything.
- **Slice 2, figures that aren't sums over runs and sessions** show the latest export's totals, marked "reporter, all time", until CR12.
- **Slice 2, from the builder check (2026-11-09):**
  - A project is its full path, worktrees folded in, behind a hashed key. Slice 1's name-based project fact and filter move to that key.
  - A session's project needs exactly one match.
  - Text naming a hidden project gets masked.
  - Counts use the workflow's call where one exists, otherwise the app's, and say how much is the app's.
  - 2a reads no CR10 field.
  - A session's time follows the fallbacks set out in 2b, and covered sessions count with their run.

## Change requests for the workflow repo (draft)

- **CR1.** Re-export the template, so the public reporter has `--json` version 1. The dashboard can't run from the public template until then.
- **CR2.** Point the 2026-11-08 design's part two to this design: the Mac first, then the home server.
- **CR3, only if ongoing sessions are in scope.** A fast way to read sessions in progress: which sessions are active, and the steps and findings of a run so far. It probably needs a machine-readable ledger line format, and a mode that reads only recently changed transcripts.
- **CR4.** Structured warnings in `--json`: today each WARN is a sentence, so grouping or charting them here would mean parsing text. Each warning would also carry its kind, its run or session, and its step or skill where it has one, next to the sentence. **Status, 2026-11-09:** built with CR8 and CR9 on `claude/dashboard-facts` ([shoklah/claude-workflow#8](https://github.com/shoklah/claude-workflow/pull/8)), CI green, open, not yet installed.
- **CR5, if the workflow diagram shows each run's path.** The reporter emits the workflow's expected steps per path, or each run's trace against them, so the diagram here doesn't hold a copy of the workflow that drifts.
- **CR6. An incremental export.** `--json` exports only the units (runs, sessions) whose facts changed since a cursor from the previous export, each under a stable key, with a new cursor. It needs the reporter to keep state between runs, which it doesn't today (it's read-only), and every total must be expressible as a sum over units so the app can rebuild it. It would also speed up `--health` and `--brief`, which sessions run at the end of every run. It needs its own design in the workflow repo.
- **CR7, only if runs have no stable key.** A key per run and per session that stays the same across exports.
- **CR8. Step times and links.** Each step's time, and each dispatch and skill load tied to its step, so the run's timeline can show when each step happened and what ran in it. Slice 1 goes without it (decision 30). **Status:** in the same pull request as CR4.
- **CR9. Session titles.** Each session's title, and the title of each run's main session, so the page can name a session instead of showing the start of its ID (decision 31). **Status:** in the same pull request as CR4.
- **CR10. Findings labels** (decision 36).
  - Each finding in the run record carries a `category` from the workflow's list, by area.
  - Each finding also carries `valid`: "valid", "invalid" or "unclear", set by the session when it applies, declines or rules the finding.
  - Each review step carries `strengths`: a list of `{category, summary}` from the reviewer's report. A strength meets the findings' bar:
    - specific: where it is and what it does
    - tied to a requirement or risk in the brief, not a general quality
    - at most three per review, each with a category from the same list
    - optional: none is recorded as an empty list, not as missing
  - The list, with a version, lives in the workflow repo. The reviewer agents' report format reads it, and `--json` exports it.
  - It needs a record schema bump and report-format changes in task-reviewer, final-reviewer, plan-reviewer and plan-simplifier.
- **CR11. Session facts** (beyond CR9's titles). For each session: its start and end, its project (the working directory), and every slash command typed, with name and time, never its arguments.
- **CR12. Totals into units.**
  - Each of these goes on the run or session it comes from: dispatch-guard refusals; the advisor's calls by role, failed calls, tokens and Fable spend; the startup flag; typed triggers.
  - The stage table is exported once.
  - Then every total on the static page is a sum over runs and sessions and takes a period, as CR6 already needs.

## Design candidates (to try; decision 29 adopts some)

**Graphical libraries and components:**
- Charts: ECharts (rich, canvas), Recharts or Tremor (quick, dashboard-shaped), visx (low-level D3 pieces, the most custom), Observable Plot (concise).
- The workflow diagram: React Flow with elkjs for automatic layout.
- Tables: TanStack Table, for the Runs list and the findings table.
- Motion: Motion (formerly Framer Motion), for the feed and the timeline.
- A command palette (cmdk) to jump to any run, session or warning.

**Design processes for the workflow:**
- **Mockups before the plan,** as in this design: screens agreed in the visual companion, with invented data, and the approved ones kept in the repo next to the spec.
- **Components in isolation:** Storybook or Ladle, each component shown on fixtures in every state (empty, loading, error, full). A story with an interaction test is the UI's failing test, which the failing-test check already accepts through Vitest.
- **Mechanical visual checks,** which can gate since they're mechanical: Playwright screenshot comparisons on fixtures, and accessibility checks with axe.
- **A visual review agent,** comparing screenshots with the approved mockup. Fuzzy, so an input to the task review, never a gate.
- **Design conventions in `CLAUDE.md`,** next to the code conventions: palette, spacing, chart rules.
- **The `dataviz` skill** loaded whenever a chart is written.
- **Later, in the reporter:** a design step kind in the run record, once a process has proven itself here.

## Open questions

1. What the Workflow page shows (slice 3). Slice 2's screens, Compliance by kind included, are designed above.
2. Ongoing sessions: what to show, and what it would cost (reporter work, refresh cost).
3. Where the workflow roadmap's UX/UI design step is described, if anywhere beyond decision 28.
4. The UX/UI slice (decision 42), which comes right after 2b (decision 48): what it covers beyond the readability of Steps and rules and Models and advisor.
5. When the owner's own marks on findings come in, as an override of the two machine judges (decision 36).
6. Categories of their own for strengths, beyond the findings' list: to assess once strengths come in (CR10).
