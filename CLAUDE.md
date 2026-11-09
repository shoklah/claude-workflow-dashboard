# claude-workflow-dashboard

A live dashboard for the Claude Code agentic workflow (`shoklah/claude-workflow`, exported as `shoklah/claude-workflow-template`). It shows what the workflow's reporter, `scripts/workflow-report.py --json`, says about runs, steps, findings and spend.

This is a personal project, used as a playground for trying things and as a portfolio piece to show. The repo is public: it holds code and invented data only, and reads the real data at run time on the owner's machine. Design decisions are recorded in `docs/superpowers/specs/2026-11-09-live-dashboard-design.md`.

## Where freedom is allowed

- **Playground: technology choice, across the stack.** Frontend and backend frameworks, the ORM and migrations, charts, styling and build tooling are free ground for trying things. Each choice is recorded under `## Stack` below with one line on why.
- **Not playground: the data rules.** Privacy, facts only from the reporter, the server's `Host` checks, raw exports kept, and tests follow the workflow's rules (TDD, simplest first, reuse before writing, match the codebase), whatever the technology.

This repo is also the testbed for the workflow's design focus: design processes and skills are tried here first, and what earns its keep goes to the workflow repo as a change request.

## Stack

The stack is final; the component kit, the graphical libraries and the mockups keep evolving, one library per job at a time, and a swap is its own small task.

- **TypeScript end to end** (backend, frontend, import validation): one set of types runs from checking the reporter's JSON on import through the API to the charts, which guards "facts agree". The reporter itself stays Python, run as a separate process.
- **Final:** Node LTS, Hono, Drizzle over SQLite (`better-sqlite3`) with its migrations, zod, React with Vite, TanStack Query and Router, Tailwind, Vitest, Storybook, Playwright, pnpm workspaces (`shared`, `server`, `web`), GitHub Actions on fixtures only.
- **Evolving, current choice:** shadcn/ui for components (its Radix base, lucide icons and `cn` come with it), React Flow for the workflow diagram, ECharts for charts (through `echarts-for-react`), TanStack Table for tables (headless, so it renders into shadcn/ui's table with the API's own row types), `@axe-core/playwright` for the accessibility checks.
- **Labeller:** `@anthropic-ai/sdk` for the labeller's calls, through the official SDK.

## Design conventions

- Screens are agreed as mockups with invented data before the plan; the approved ones live in `docs/design/<date>-<topic>/`.
- Every component has Storybook stories on invented fixtures for its empty and full states, and a component that fetches data also for loading and error; a story with an interaction test is the UI's failing test.
- Screens are checked on fixtures with Playwright screenshot comparisons and axe accessibility checks.
- Charts are written with the `dataviz` skill loaded.

## Code conventions

- The data is personal (project paths, branch names, session IDs, costs, finding text): never commit real data, never put it in fixtures, never publish it publicly. Fixtures are invented.
- `workflow-report.py` is the only parser of the run log and the transcripts: when the dashboard needs a new fact, it goes to the workflow repo as a change request, never parsed here.
- This repo never edits the workflow repo or the template; they are a reference and the data source.
- Relative imports carry their `.ts` extension and type-only imports use `import type`; packages export their TypeScript sources, with no build step.
- The reporter's JSON schema lives in `packages/shared/src/report.ts`: every field is `.nullish()` (a `z.unknown()` one `.optional()`) unless the loader can't work without it; it validates the fields the dashboard reads plus those kept for slice 2's pages, any other field is left out, so it is stripped, and whether an unread field's drift should fail an import is the owner's call.
- A time from the reporter becomes a `Date` only through `parseTime` in `packages/shared/src/week.ts`, which reads a zone-less time as UTC as the reporter does, never through `new Date` or `Date.parse`.
- A fixture's `totals.weeks` agrees with its runs by the reporter's `week_rows` rules: per week start date, `runs` by path and `cost` as the sum of the priced cost of the runs with `models`, null when none has them.
- Stored derived values (a unit's `merged`, `readable`, `firstSeenAt` and its warnings) are written only by `applyVersion` in `packages/server/src/db/import.ts`, which both the import and `rebuildDerived` call, so a rebuild from `unitVersions` always gives the same rows; a new derived value goes there.
- `units.missing_since`, `imports`, `state`, the app's finding labels (`finding_labels`) and the labeller's batches (`label_batches`) are stored facts, not derived: nothing in `unit_versions` can rebuild them, so a migration that drops or recreates their tables carries their values over.
- The Anthropic API key and the labeller's settings live only in the data folder's `.env`, which the committed `.env.example` names and `process.loadEnvFile` loads. The key never reaches the repo, a fixture, a log or an error text. No test calls the API: the client is injected and stubbed. With no key, the labeller stays off.
- The app's finding labels show as the app's judgment, never as the reporter's facts. A workflow label, from the reporter, wins wherever both exist.
- Showing mode's scope is server state, through `packages/server/src/views/scope.ts`: a route builds it with `scopeOf` and passes it to its view, and only views apply it, with `showFacts`, `showWarning` and `maskText`; no route masks or filters. Each view's tests check with the leak check `leaks`, beside them, that a showing-mode response holds no hidden project's name, path or branch, and no session ID.
- `projectNames` in `packages/shared/src/projects.ts` is the one place a project's display name is made, with the config's `aliases` when given.
- Migrations are generated with `drizzle-kit generate` from `packages/server/src/db/schema.ts` into `packages/server/drizzle/` and never hand-edited; SQL names are snake_case, times are `timestamp_ms` integers and JSON is `text` in `json` mode.
- Tests in any package read the invented fixtures, their JSON (`fixture`) or their file path (`fixturePath`), through `packages/shared/test/fixture.ts`, and every database test opens a fresh file in its own temp folder.
- A failure's error text (the reporter's, an import's, the labeller's) never quotes the reporter's stdout or the model's reply, which hold the data: it names the command, the exit and stderr's last line, the API's own error, or a fixed message; model calls go only through `anthropicLabelClient` in `packages/server/src/labeller.ts`, which turns the reply parser's errors into a fixed message.
- Background work runs through `createQueue` in `packages/server/src/queue.ts`, one queue per job named by its second argument (`import`, `label`), which logs a failing job under that name instead of rejecting, so a background error never crashes the server.
- A test that waits on an `fs.watch` event repeats the change inside `vi.waitFor`, since macOS can drop a change made right after the watch starts.
- Node runs the TypeScript sources directly with its built-in type stripping (Node >= 22.18, the `engines` floor), as in `check:real`: code stays erasable-only TypeScript (`erasableSyntaxOnly` in `tsconfig.base.json`), with no enums, namespaces or parameter properties.
- The server's request rules (the `Host` check, and for any method but GET and HEAD the `X-Dashboard-Refresh: 1` header and an allowed `Origin`) live only in `createApp`'s one middleware in `packages/server/src/app.ts`, which runs before every route; a route never checks them itself, and nothing sets an `Access-Control-*` header.
- API routes are added in `registerRoutes` in `packages/server/src/routes.ts`, one block per task; a POST-only route answers any other method with `postOnly` (405), and the server listens only through `serveApp`, on 127.0.0.1.
- Error text sent to the page goes through `trimPaths` in `packages/server/src/text.ts`, which cuts each absolute path to its last segment; the stored text stays whole.
- The app's finding labels are written only through `saveBatch`, and a label shown anywhere comes from `currentLabels`, both in `packages/server/src/db/labels.ts`.
- A page's API response is built by a pure function in `packages/server/src/views/<page>.ts` of the stored units, warnings, seen time and `now`, into its response type in `packages/shared/src/api/<page>.ts`; its route block only reads the database (`listUnits`, `listWarnings`, `getSeenAt`, `deps.now()`), parses the query and calls it.
- A week is named by its start date through `weekOf` in `packages/shared/src/week.ts`, as the reporter's `totals.weeks[].week`.
- A project is its root (`projectRoot` in `packages/shared/src/projects.ts`: the record's project with worktrees folded in) behind `projectKey` in `packages/server/src/keys.ts`; API responses carry the key and a display name (`storedFacts` in `views/runs.ts`), never the path.
- Home's week sums (runs by path, cost) come only from `weekSums` in `packages/server/src/views/home.ts`, which check:real also compares with the reporter's `totals.weeks`; a new weekly sum goes there with its check.
- A skill's outcome leaves the backend only as `skillOutcomeLabel`'s label in `packages/server/src/views/runs.ts`, since a string outcome is a file path.
- A run's warnings, wherever they show, are the texts in its latest merged `warns` (`currentWarnings` in `views/runs.ts`); the stored `warnings` table only supplies first-seen times.
- A finding leaves the backend only as `runView` in `views/runs.ts` builds it, with its label and, with a scope, its masking; the Findings page's list included.
- A list's `path`, `project` (a key) and `weeks` (default 4) query params are parsed only by `periodQuery` in `packages/server/src/routes.ts`.
- The web app reads the API only through `src/api.ts` in `packages/web`: `useStatus` for the import's status, `useLiveQuery` for every page's data (its key holds the last good import's time, so data refetches in place when an import lands), and `refresh`, `markSeen` and `showProjects` for the POSTs, which share its one `post` helper.
- shadcn/ui components are added with its CLI (`packages/web/components.json`) into `src/components/ui/`; its `@/` alias is for the CLI and the files it writes, and the app's own code imports them relatively, with their extension.
- shadcn's `Table` forwards `containerProps` to its scroll container, the one hand edit in `src/components/ui/`; a table that scrolls sideways passes `tabIndex: 0`, `role: 'region'` and an `aria-label` through it.
- Stories get the app's providers (a query cache without retries, tooltips, a memory router on `/` or the story's `parameters.path`) from `.storybook/preview.tsx`, and stub the API with `mockApi` from `src/test/mock-api.ts` in their `beforeEach`; the web package's other tests are `src/**/*.test.tsx`, run in chromium like the stories.
- `@cwd/shared` runs in the browser and in Node, so it imports no `node:` module; Node-only code (run and session keys, `keys.ts`) lives in `packages/server`, and the web app imports shared types and values from `@cwd/shared`, never by relative path.
- A page that fetches takes what its route gives it (a run's key) as a prop, so its stories render it without route params.
- Story fixtures a screen's stories share are invented API responses in `packages/web/src/test/<screen>.ts`.
- The web app's display formatting (costs, durations, plurals, step names, "project · branch") lives in `packages/web/src/lib/format.ts`, one function or map per fact on every screen (`STEP_LABELS` for step kinds); a fact that isn't known shows as its `NONE`, "–", and a duration is rounded to whole minutes first, then shown as "25 min" or "2 h 10".
- A finding's category shows through `categoryLabel` in `packages/web/src/lib/format.ts` ("unlabelled" when null), a set category always in a dashed outline badge titled "The app's label" while every label is the app's.
- Charts use ECharts with the SVG renderer and no animation, the dataviz reference palette's light slots in fixed order, a `role="img"` container with an aria-label, and a table view of their numbers.
- Playwright's `checks` are `packages/web/e2e/*.spec.ts` (axe and behaviour, anywhere); its `screens` are `e2e/*.screens.ts`, run only by `pnpm test:screens` in the container, with their baselines committed; every e2e test pins the browser clock with `pinClock` to dev:fixtures' time.
- The launchd agent's plist comes only from the pure `plist()` in `packages/server/src/agent.ts`; it runs `src/main.ts` with the absolute `node` that ran `pnpm agent:install`, since there is no server bundle (the root `build` builds only the web app `main.ts` serves), and no test writes to `~/Library/LaunchAgents` or runs `launchctl`.
- CI (`.github/workflows/ci.yml`) runs the same commands as local development, the screens through `pnpm test:screens`, whose container runs as `linux/amd64` everywhere so local baselines match CI's renders, on fixtures only and with no secret.
