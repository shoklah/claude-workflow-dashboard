# Live workflow dashboard: design

Started 2026-11-09. **Status: slice 1 approved by the owner on 2026-11-09; later slices open.** This is also the running record of the design: each session adds its decisions to the record and ends with the open questions.

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
- The app and the reporter disagree on a fact.
- Another website can read the local server's data or drive it.
- Stored history goes stale without saying so, or a migration loses data that can't be rebuilt.
- The playground never ships: slice 1 ends with the live home working on the owner's real data.

## Constraints

- The reporter is the installed copy, JSON version 1, about 20 to 30 s per export, and it runs only on the Mac, as `/usr/bin/python3 -I <path> --json`.
- The workflow applies in full: the Full path, TDD with the failing-test check, task and final reviews. Two parts are risk areas: the local server's request checks, and any migration of stored data.
- Personal data lives only in `~/Library/Application Support/claude-workflow-dashboard/`, outside every repo.

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

## Change requests for the workflow repo (draft)

- **CR1.** Re-export the template, so the public reporter has `--json` version 1. The dashboard can't run from the public template until then.
- **CR2.** Point the 2026-11-08 design's part two to this design: the Mac first, then the home server.
- **CR3, only if ongoing sessions are in scope.** A fast way to read sessions in progress: which sessions are active, and the steps and findings of a run so far. It probably needs a machine-readable ledger line format, and a mode that reads only recently changed transcripts.
- **CR4.** Structured warnings in `--json`: today each WARN is a sentence, so grouping or charting them here would mean parsing text. Each warning would also carry its kind, its run or session, and its step or skill where it has one, next to the sentence.
- **CR5, if the workflow diagram shows each run's path.** The reporter emits the workflow's expected steps per path, or each run's trace against them, so the diagram here doesn't hold a copy of the workflow that drifts.
- **CR6. An incremental export.** `--json` exports only the units (runs, sessions) whose facts changed since a cursor from the previous export, each under a stable key, with a new cursor. It needs the reporter to keep state between runs, which it doesn't today (it's read-only), and every total must be expressible as a sum over units so the app can rebuild it. It would also speed up `--health` and `--brief`, which sessions run at the end of every run. It needs its own design in the workflow repo.
- **CR7, only if runs have no stable key.** A key per run and per session that stays the same across exports.
- **CR8. Step times and links.** Each step's time, and each dispatch and skill load tied to its step, so the run's timeline can show when each step happened and what ran in it. Slice 1 goes without it (decision 30).
- **CR9. Session titles.** Each session's title, and the title of each run's main session, so the page can name a session instead of showing the start of its ID (decision 31).

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

1. What the other screens show: Workflow, Compliance, Sessions and the rest of the menu (slices 2 and 3).
2. Ongoing sessions: what to show, and what it would cost (reporter work, refresh cost).
3. Where the workflow roadmap's UX/UI design step is described, if anywhere beyond decision 28.
