# Live dashboard, slice 1 ("Live home") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local app on the owner's Mac that imports the workflow reporter's JSON into SQLite on each trigger and shows the home screen, the Runs list and one run, live, on 127.0.0.1.

**Architecture:** A pnpm workspace with three packages. `shared` holds the zod schemas of the reporter's JSON (the loader), the keys, the week rule, the per-run facts and the API types. `server` (Hono on Node) runs the reporter as a child process, imports each export into SQLite with Drizzle (raw versions kept, merged facts derived), serves a JSON API with strict request rules and the built frontend. `web` (React, Vite) polls the server's status and refetches in place.

**Tech Stack:** Node LTS, TypeScript, pnpm workspaces, zod, Hono, Drizzle with `better-sqlite3`, React, Vite, TanStack Query and Router, Tailwind, shadcn/ui, React Flow, ECharts, Vitest, Storybook (with its Vitest addon), Playwright, axe (`@axe-core/playwright`), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-09-live-dashboard-design.md` (slice 1 approved 2026-11-09). Mockups: `docs/design/2026-11-09-live-dashboard/`.

## Global Constraints

- Packages: `packages/shared` (`@cwd/shared`), `packages/server` (`@cwd/server`), `packages/web` (`@cwd/web`). Library versions: the latest stable at task time, pinned in `package.json`; each new library gets a line under `## Stack` in `CLAUDE.md` only if it isn't already listed there.
- The reporter runs as `/usr/bin/python3 -I ~/.claude/scripts/workflow-report.py --json` by default; the command is configurable. Only `version` 1 is accepted. A missing key is absent; an unknown key is ignored.
- Personal data lives only in `~/Library/Application Support/claude-workflow-dashboard/` (`dashboard.sqlite`, `config.json`), created with mode `0700`. Nothing real is ever written into the repo.
- Tests point every path (data dir, reporter command, run log, projects dir) into temp folders: no test reads `~/.claude` or the real data dir. Fixtures are invented: no real project names, paths, branches or session IDs.
- The server listens on `127.0.0.1`, port `4317` by default (configurable). It refuses any request whose `Host` isn't `localhost:<port>` or `127.0.0.1:<port>` with 403, sends no `Access-Control-*` header on any response, and accepts the refresh only as `POST /api/refresh` with header `X-Dashboard-Refresh: 1` and, when an `Origin` header is sent, an `Origin` of `http://localhost:<port>` or `http://127.0.0.1:<port>`.
- A week starts on Sunday at 07:00 UTC, as in the reporter.
- Facts agree: the app never re-derives a fact the reporter gives. Totals the app shows are plain sums over runs' own facts, each with its definition in a comment next to the sum.
- What leaves the backend is trimmed: a project shows as the last segment of its path; no API response holds an absolute path or a transcript path. A session ID may reach the live page, where it shows by its name with the full ID on hover and a copy button beside it (spec decision 31); a warning's text carries it as a `{session}` placeholder plus a separate `sessionId`.
- Failing-test check, after each task: `/usr/bin/python3 -I ~/.claude/scripts/failing-test-check.py --base <task start SHA> --link node_modules --link packages/shared/node_modules --link packages/server/node_modules --link packages/web/node_modules --timeout 240 -- pnpm vitest run <the task's test files>`, passing `--link` only for the folders that exist at the task's head and `--test-file` for each of the task's test files. The root `vitest.config.ts` lists the three packages as projects, so `pnpm vitest run <file>` runs any package's test from the root.
- Screenshot tests run only inside the Playwright container matching the installed `@playwright/test` version (`pnpm test:screens` locally, the same image in CI), so baselines don't depend on the Mac's fonts. Axe checks and interaction tests run anywhere.
- Charts are written with the `dataviz` skill loaded. Every component gets Storybook stories on fixtures for its empty and full states; components that fetch data (pages, the shell) also get loading and error states.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Free text with HTML in it** (a finding summary or branch name like `<img src=x onerror=alert(1)>`): shown as text in the feed, the Runs list and the run page. Pinned in Tasks 9 and 10.
2. **A week boundary in the owner's time zone**: a run finishing Sunday 06:59 UTC belongs to the previous week, 07:00 UTC to the new one, with `TZ=Europe/Paris`. Pinned in Task 1.
3. **A reporter that exits 0 but prints nothing, or prints text before the JSON**: a failed import with a banner, never an empty dashboard. Pinned in Task 3.
4. **The reporter isn't installed** (the app installed without the workflow, or the script moved): a failed import with a banner naming the missing command, never a crash. Pinned in Task 3.
5. **Paths with spaces** (the data dir is under `Application Support`): config, the database and the reporter command all work with a space in the path. Pinned in Task 3.

---

**Before Task 1:** the implementation branch starts from a commit that holds `CLAUDE.md`, `.gitignore`, the spec, this plan and the mockups, so Task 1 has a start SHA for its failing-test check.

### Task 1: Workspace, the loader, keys and the week rule

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.config.ts`, `.nvmrc`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`
- Create: `packages/shared/src/report.ts`, `packages/shared/src/load.ts`, `packages/shared/src/keys.ts`, `packages/shared/src/week.ts`
- Create: `packages/shared/fixtures/report-full.json`, `report-later.json`, `report-shape.json`
- Test: `packages/shared/test/load.test.ts`, `packages/shared/test/keys.test.ts`, `packages/shared/test/week.test.ts`

**Interfaces:**
- Produces: `ReportSchema`, `RunEntrySchema`, `SessionEntrySchema` and the types `Report`, `RunEntry`, `RunRecord`, `Step`, `Finding`, `SessionEntry`, `Totals`, `StepKind` (`'plan_simplify' | 'plan_review' | 'task_review' | 'fix_check' | 'simplify' | 'final_review' | 'final_fix_check'`), `Outcome` (`'fixed' | 'applied' | 'declined' | 'deferred' | 'ruled' | 'open' | 'to_owner'`).
- Produces: `loadReport(raw: unknown): LoadResult`, with `LoadResult = { ok: true; report: Report } | { ok: false; reason: 'version' | 'shape'; fields: string[] }`. `fields` are the failing field paths with array indices written `[]` and map keys written `{}` (for example `runs[].models{}.cost`), so they never hold a value.
- Produces: `runKey(run: RunEntry): string | null` (the first 16 hex characters of the SHA-256 of `${record.date}|${record.project}|${record.branch}`, null when `date` is missing), `sessionKey(s: SessionEntry): string` (the same hash of its `file`). Keys go into URLs and API responses, so they hold no path.
- Produces: `weekStart(t: Date): Date` (the latest Sunday 07:00 UTC at or before `t`).
- Later tasks use `['cat', '<fixture path>']` as the fake reporter command.

The schema follows the reporter's `--json` (read the workflow repo's `scripts/workflow-report.py`, locally `~/Work/claude-workflow/scripts/workflow-report.py`: `run_entry`, `read_steps`, `read_waves` and `report_data`, without running it). Every field is optional and nullable unless the loader can't work without it (`version`, `runs`, `sessions`, `totals`, and each session's `file`); unknown keys are stripped from the parsed result. `skills[].outcome` is `unknown`: the reporter gives a file path, an object, a list, a boolean, `'ran'` or null depending on the skill. `runKey` hashes an absent `project` or `branch` as an empty string.

`report-full.json` holds, all invented: a Full schema 2 run with two waves and a wave check (`steps[].wave`), findings in every outcome and a `ruled` one with a `reason`; a Small run; a `path: "plan"` record with `plan_simplify` cuts and flags and a `plan_review`; a schema 1 record with no `steps`; a run whose window facts are null (`window`, `models`, `skills`, `dispatches`); two sessions, one of whose `file` equals the Full run's `window.transcript`; warnings on two runs and one session, the session's in the reporter's form (`WARN: session 0f3c9a2e-….jsonl: …`, an invented ID); a `brainstorming` skill whose `outcome` is an invented absolute spec path; `totals` with `weeks` that agree with the runs. `report-later.json` is the next export: the Full run gains a later fix commit, the Small run's `window` and `models` turn null, one session is gone, and one new run and one new warning appear.

- [ ] **Step 1: Write the failing tests**

`load.test.ts`: `accepts the full fixture` (`ok` true, 5 runs, 2 sessions); `refuses version 2` (the full fixture with `version: 2`, built in the test: `reason: 'version'`); `reports field paths for a bad shape` (`report-shape.json`, whose Full run has `steps: "x"`: `fields` equals `['runs[].steps']`); `ignores unknown keys` (a key `extra` added to a run is absent from the parsed run); `treats a missing key as absent` (a run without `minutes` parses with `minutes` undefined); `writes map keys as {}` (a run whose `models` entry has `cost: "x"` gives `runs[].models{}.cost`).
`keys.test.ts`: `runKey is 16 hex characters`; `runKey differs when the branch differs`; `runKey holds no path` (no `/` and no part of the fixture's project); `runKey is null without a date`; `sessionKey hashes the file`.
`week.test.ts`, run with `process.env.TZ = 'Europe/Paris'`: `Sunday 06:59Z belongs to the previous week` (`weekStart(2026-11-08T06:59Z)` is `2026-11-01T07:00Z`); `Sunday 07:00Z starts a week` (`2026-11-08T07:00Z`); `Saturday night belongs to the week` (`2026-11-14T23:00Z` → `2026-11-08T07:00Z`).

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run packages/shared/test`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `report.ts`, `load.ts`, `keys.ts` (`node:crypto`), `week.ts` and the fixtures**

`loadReport` checks `version === 1` first, then `ReportSchema.safeParse`; field paths come from zod's issue paths with numeric segments turned into `[]` and the segment under a `z.record` turned into `{}` (found by walking the schema along the path), deduplicated.

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm vitest run packages/shared/test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json vitest.config.ts .nvmrc pnpm-lock.yaml packages/shared
git commit -m "feat: workspace, the reporter JSON loader, keys and the week rule"
```

### Task 2: The database and the import

**Risk area:** stored data and its migrations.

**Files:**
- Create: `packages/server/package.json`, `packages/server/tsconfig.json`, `packages/server/drizzle.config.ts`
- Create: `packages/server/src/db/schema.ts`, `packages/server/src/db/open.ts`, `packages/server/src/db/merge.ts`, `packages/server/src/db/import.ts`, `packages/server/src/db/read.ts`, `packages/server/drizzle/` (generated migration)
- Test: `packages/server/test/import.test.ts`, `packages/server/test/merge.test.ts`

**Interfaces:**
- Consumes: `Report`, `RunEntry`, `SessionEntry`, `runKey`, `sessionKey` (Task 1).
- Produces: tables `units` (`kind` `'run' | 'session'`, `key`, `firstSeenAt`, `missingSince` nullable, `readable` boolean (for a run: its latest export had a non-null `window`), `merged` JSON text; primary key `(kind, key)`), `unitVersions` (`kind`, `key`, `receivedAt`, `raw` JSON text; the change log), `warnings` (`kind`, `key`, `text`, `firstSeenAt`; unique `(kind, key, text)`), `imports` (`id`, `at`, `ok`, `error` nullable, `totals` JSON text nullable), `state` (`name`, `value`).
- Produces: `openDb(file: string): Db` (creates the file's folder with mode `0700`, runs the migrations).
- Produces: `mergeKnown(prev: unknown, next: unknown): unknown`.
- Produces: `importReport(db: Db, report: Report, rawUnits: { runs: unknown[]; sessions: unknown[] }, at: Date): void`, where `rawUnits.runs[i]` is the raw JSON of `report.runs[i]` (and likewise for sessions); a run with no key is skipped. And `recordImportFailure(db: Db, error: string, at: Date): void`.
- Produces: `rebuildDerived(db: Db): void`: rebuilds every derived value from `unitVersions`: `merged`, `readable`, `firstSeenAt`, and the `warnings` table (a warning's `firstSeenAt` is the `receivedAt` of the first version holding it).
- Produces, in `read.ts`: `listUnits(db: Db, kind: 'run' | 'session'): StoredUnit[]` (`{ key, merged, firstSeenAt, missingSince, readable }`, `merged` parsed with `RunEntrySchema` or `SessionEntrySchema`), `listWarnings(db: Db): StoredWarning[]` (`{ kind, key, text, firstSeenAt }`), `getSeenAt(db: Db): Date | null`, `setSeenAt(db: Db, at: Date): void`, `lastImport(db: Db): { at: Date; ok: boolean; error: string | null } | null`, `lastGoodImport(db: Db): { at: Date; totals: unknown } | null`.

Rules, from the spec's import steps:
- One transaction per import. A unit's raw JSON gets a new `unitVersions` row only when it differs from its latest version; these rows are the change entries the spec asks for. A unit seen for the first time gets its first version and its `firstSeenAt`.
- `merged` is `mergeKnown(previous merged, new raw)`: for objects, key by key, a `null` or missing value in `next` keeps a non-null value from `prev`; any other value in `next` wins; arrays and scalars from `next` replace when not null. `rebuildDerived` folds `mergeKnown` over each unit's versions in order.
- A unit stored but absent from the export gets `missingSince = at` (kept when already set) and is never deleted; one present again gets `missingSince = null`.
- Each warning in a run's or session's `warns` is inserted by `(kind, key, text)` when new, with `firstSeenAt = at`; an existing one is left as it is.
- The first successful import (no earlier `imports` row with `ok`) sets the `seenAt` state to `at`, so the feed starts empty.
- `recordImportFailure` writes an `imports` row with `ok` false and changes nothing else.

- [ ] **Step 1: Write the failing tests**

`merge.test.ts`: `null keeps a known value` (`mergeKnown({cost: 3}, {cost: null})` is `{cost: 3}`); `missing keeps a known value`; `a new value wins`; `nested objects merge key by key`; `an array replaces`; `a null array keeps the known one`.
`import.test.ts`, each on a fresh temp file: `first import stores every unit with one version` (5 runs, 2 sessions, 7 versions); `first import sets seenAt to its time`; `the same report twice writes no new version`; `a changed run gets a new version` (`report-later.json`: the Full run); `a later null keeps the earlier models` (the Small run's `merged.models` unchanged after `report-later.json`, and its `readable` false); `a unit missing from the export is marked, not deleted` (the gone session has `missingSince` set and is still listed); `a warning keeps its first-seen time`; `a failure leaves the stored data unchanged` (`recordImportFailure`, then `listUnits` equal before and after, `lastImport().ok` false); `rebuild gives the same derived rows` (after both imports, `rebuildDerived` leaves `merged`, `readable`, `firstSeenAt` and every warning equal).

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run packages/server/test/merge.test.ts packages/server/test/import.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the schema, generate the migration with `drizzle-kit generate`, then `open.ts`, `merge.ts`, `import.ts` and `read.ts`**

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm vitest run packages/server/test/merge.test.ts packages/server/test/import.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server pnpm-lock.yaml
git commit -m "feat: SQLite store with raw versions, merged facts and the import"
```

### Task 3: Config, the reporter runner, the import queue and the triggers

**Files:**
- Create: `packages/server/src/config.ts`, `packages/server/src/reporter.ts`, `packages/server/src/queue.ts`, `packages/server/src/triggers.ts`, `packages/server/src/check-real.ts`
- Modify: `packages/server/package.json` (script `check:real`)
- Test: `packages/server/test/config.test.ts`, `packages/server/test/reporter.test.ts`, `packages/server/test/queue.test.ts`, `packages/server/test/triggers.test.ts`, `packages/server/test/check-real.test.ts`

**Interfaces:**
- Consumes: `loadReport` (Task 1); `openDb`, `importReport`, `recordImportFailure`, `lastGoodImport` (Task 2).
- Produces: `loadConfig(dataDir?: string): Config`, `Config = { dataDir: string; port: number; reporterCommand: string[]; runLog: string; projectsDir: string; reporterTimeoutMs: number }`. Defaults: `dataDir` `~/Library/Application Support/claude-workflow-dashboard`, `port` 4317, `reporterCommand` `['/usr/bin/python3', '-I', '~/.claude/scripts/workflow-report.py', '--json']` with `~` expanded, `runLog` `~/.claude/workflow-log.jsonl`, `projectsDir` `~/.claude/projects`, `reporterTimeoutMs` 120000. Values in `<dataDir>/config.json` override them. The data dir is created with mode `0700`.
- Produces: `runReporter(cmd: string[], timeoutMs: number): Promise<{ ok: true; json: unknown } | { ok: false; error: string }>`.
- Produces: `importOnce(db: Db, config: Config, now: () => Date): Promise<void>` (runs the reporter, loads, imports or records the failure with its error text).
- Produces: `createQueue(job: () => Promise<void>): { request(): void; busy(): boolean; idle(): Promise<void> }` (one job at a time; requests during a job collapse into one follow-up).
- Produces: `startTriggers(config: Config, request: () => void, lastImportAt: () => Date | null): { stop(): void }`: a watch on `runLog` (its folder, filtered to the file, so a replaced file still triggers); a 15-minute timer that requests only when a `.jsonl` file under `projectsDir` changed after `lastImportAt()`; a missing `projectsDir` or `runLog` never throws.
- Produces: `pnpm --filter @cwd/server check:real`: runs the configured reporter once, prints `version: <n>`, then either `fields: none` or one failing field path per line, then `run keys: <n> duplicates, <n> missing`; nothing else, never a value.

- [ ] **Step 1: Write the failing tests**

`config.test.ts`, in a temp folder whose path holds a space: `defaults expand the home folder`; `config.json overrides a default`; `the data dir is created with mode 0700`.
`reporter.test.ts` (with `cat <fixture>` and small `node -e` scripts as the reporter): `returns the parsed JSON`; `a fixture path with a space works`; `a missing reporter command is an error naming it` (`ENOENT`, the message holds the command); `a non-zero exit is an error with its stderr's last line`; `exit 0 with empty output is an error "reporter printed no JSON"`; `text before the JSON is an error`; `a reporter past the timeout is killed and reported` (timeout 200 ms on a script that sleeps).
`queue.test.ts`: `runs one job at a time`; `requests during a job make exactly one follow-up`.
`triggers.test.ts` (fake timers, temp folders): `a change to the run log requests an import`; `replacing the run log file requests an import`; `the timer requests when a transcript changed after the last import`; `the timer stays quiet when nothing changed`; `missing folders don't throw`.
`check-real.test.ts` (reporter = `cat <fixture>`): `prints version, fields and key counts only` (on `report-full.json`: exactly `version: 1`, `fields: none`, `run keys: 0 duplicates, 0 missing`); `prints field paths for a bad shape`; `never prints a value` (no line contains any `project` or `branch` value from the fixture).

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run packages/server/test/config.test.ts packages/server/test/reporter.test.ts packages/server/test/queue.test.ts packages/server/test/triggers.test.ts packages/server/test/check-real.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `config.ts`, `reporter.ts` (`child_process.spawn`, stdout collected, `JSON.parse` of the trimmed whole), `queue.ts`, `triggers.ts` (`fs.watch` on the folder, `setInterval` 15 minutes, a recursive `stat` walk for the newest `.jsonl` mtime) and `check-real.ts`**

- [ ] **Step 4: Run them to verify they pass**

Same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server
git commit -m "feat: reporter runner, import queue, refresh triggers and the local field check"
```

### Task 4: The HTTP server and its request rules

**Risk area:** the local server's request checks.

**Files:**
- Create: `packages/server/src/app.ts`, `packages/server/src/routes.ts`, `packages/server/src/main.ts` (wiring only, no test of its own)
- Create: `packages/shared/src/api/status.ts`
- Modify: `packages/shared/src/index.ts` (export `api/status`)
- Modify: `packages/server/package.json` (scripts `start`, `dev:fixtures`)
- Test: `packages/server/test/app.test.ts`

**Interfaces:**
- Consumes: Tasks 2 and 3.
- Produces: `StatusResponse = { lastImportAt: string | null; lastGoodImportAt: string | null; error: string | null; importing: boolean }` in `@cwd/shared`.
- Produces: `createApp(deps: AppDeps): Hono`, `AppDeps = { db: Db; port: number; requestImport: () => void; importing: () => boolean; webDist: string | null; now: () => Date }`. The request rules are one middleware on every route. Routes: `GET /api/status`, `POST /api/refresh` (202), `POST /api/seen` (sets `seenAt` to `now()`, 204, same header rule as refresh), and, when `webDist` is set, the built files with `index.html` as fallback for non-`/api` paths.
- Produces: `registerRoutes(app: Hono, deps: AppDeps): void` in `routes.ts`, where later tasks add their routes (one block per task).
- Produces: `main.ts`: loads the config, opens the database, creates the queue around `importOnce`, starts the triggers, requests one import at start, listens on `127.0.0.1:<port>`.
- Produces: `pnpm --filter @cwd/server dev:fixtures [fixture]`: starts the server with a temp data dir and `reporterCommand` `['cat', 'packages/shared/fixtures/<fixture>.json']` (default `report-full`), for the frontend's tests.

- [ ] **Step 1: Write the failing tests**

`app.test.ts` (Hono's `app.request`, port 4317): `allows Host localhost:4317` and `allows Host 127.0.0.1:4317` (200 on `/api/status`); `refuses Host evil.example` (403); `refuses Host localhost:9999` (403); `refuses a request with no Host` (403); `sends no Access-Control header` (on GET, on OPTIONS, and on a 403); `refresh without its header is refused` (403, `requestImport` not called); `refresh with a foreign Origin is refused` (`Origin: http://evil.example`, 403); `refresh with its header queues an import` (202, called once); `GET on refresh is not allowed` (405); `status reports the last failure` (after `recordImportFailure`, `error` is its text); `seen sets the seen time`; `serves index.html for an unknown non-api path`.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run packages/server/test/app.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `app.ts`, `routes.ts`, `main.ts`, `api/status.ts` and the two scripts**

- [ ] **Step 4: Run them to verify they pass**

Same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server packages/shared
git commit -m "feat: local server with Host, CORS and refresh rules"
```

### Task 5: Per-run facts

**Files:**
- Create: `packages/shared/src/facts.ts`
- Modify: `packages/shared/src/index.ts` (export `facts`)
- Test: `packages/shared/test/facts.test.ts`

**Interfaces:**
- Consumes: `RunEntry`, `Step`, `Outcome`, `runKey` (Task 1).
- Produces: `runFacts(run: RunEntry): RunFacts`, `RunFacts = { key: string; project: string; branch: string | null; path: 'small' | 'full' | 'plan' | null; stage: string | null; startedAt: string | null; finishedAt: string | null; minutes: number | null; cost: number | null; findings: FindingSplit; warnings: number; stops: number | null; tasks: number | null; waves: number; beforeSteps: boolean }`.
- Produces: `FindingSplit = { total: number; actedOn: number; notActedOn: number; open: number }` and `splitFindings(steps: Step[]): FindingSplit`.
- Produces: `splitSessionId(text: string): { text: string; sessionId: string | null }`: the first `<uuid>.jsonl` in a warning's text becomes `{session}` and its UUID goes to `sessionId`.

Definitions (each written as a comment next to its code): `project` is the last segment of `record.project`; `cost` is null when `models` is null, otherwise the sum of the non-null `cost` of its entries (0 when none is priced), as the reporter's `spent` does; `stops` is `record.stops`; `findings` counts every finding of every step, acted on = `fixed` or `applied`, not acted on = `declined`, `deferred`, `ruled` or `to_owner`, open = `open`, and a finding with no outcome counts in `total` only; `beforeSteps` is `schema < 2`; `waves` is the length of `waves`.

- [ ] **Step 1: Write the failing tests**

`facts.test.ts` on `report-full.json`: `project is the last path segment` (and no `/` in it); `cost sums the priced models` (the Full run's fixture costs); `cost is null with no models`; `cost is 0 when no model is priced`; `stops comes from the record`; `findings split by outcome` (the Full run's exact counts from the fixture); `a finding with no outcome counts in total only`; `a schema 1 run is before steps`; `waves counts the run's waves`; `splitSessionId takes the session out of a warning` (the fixture's session warning gives `WARN: session {session}: …` and the invented UUID); `splitSessionId leaves a run warning alone`.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run packages/shared/test/facts.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `facts.ts`**

- [ ] **Step 4: Run it to verify it passes**

Same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat: per-run facts with the findings split and cost sum"
```

### Task 6: The home API

**Wave:** A

**Files:**
- Create: `packages/server/src/views/home.ts`, `packages/shared/src/api/home.ts`
- Modify: `packages/server/src/routes.ts` (adds the `GET /api/home` block only), `packages/shared/src/index.ts` (adds the `api/home` export line only), `packages/server/src/check-real.ts` (adds the weeks comparison)
- Test: `packages/server/test/home.test.ts`; modify `packages/server/test/check-real.test.ts` (adds the weeks test, and the `weeks:` line to the exact-output test)

**Interfaces:**
- Consumes: `listUnits`, `listWarnings`, `getSeenAt` (Task 2); `registerRoutes` (Task 4); `runFacts`, `splitFindings`, `splitSessionId`, `weekStart` (Tasks 1 and 5).
- Produces: `HomeResponse` in `@cwd/shared`: `{ thisWeek: WeekNumbers; lastWeek: WeekNumbers; diagram: { full: DiagramStep[]; small: DiagramStep[]; fixChecks: { full: FixLine; small: FixLine }; beforeSteps: number }; charts: { weeks: string[]; findingsByStep: Record<StepKind, number[]>; cost: (number | null)[]; warnings: number[] }; feed: FeedItem[]; coverageFrom: string | null }`, with `WeekNumbers = { runs: { small: number; full: number; plan: number }; findings: FindingSplit; cost: number | null; costPerRun: number | null; warnings: number; newWarnings: number }`, `DiagramStep = { step: StepKind; ran: number; findings: number; actedOn: number; warnings: number }`, `FixLine = { ran: number; open: number; roundThree: number }`, `FeedItem = { at: string; type: 'run' | 'warning'; runKey: string | null; project: string | null; branch: string | null; path: string | null; text: string | null; sessionId: string | null; findings: FindingSplit | null; minutes: number | null; cost: number | null }`.
- Produces: `homeView(input: { runs: StoredUnit[]; warnings: StoredWarning[]; seenAt: Date | null; now: Date }): HomeResponse`, and `GET /api/home`.
- Produces: `weekSums(runs: RunEntry[]): Map<string, { runs: { small: number; full: number; plan: number }; cost: number | null }>` (by week start date), used by `homeView` and by `check:real`, which then prints `weeks: <n> compared, <m> differ` and the differing week dates, comparing with the same export's `totals.weeks` `runs` and `cost` (cost compared to the cent).

Definitions: a run's week is `weekStart(finishedAt)`; `thisWeek` is `weekStart(now)`. Warning texts in the feed go through `splitSessionId`. A week's warnings are its runs' `RunFacts.warnings` (their latest `warns`) plus session warnings first seen in it; `newWarnings` are those first seen after `seenAt`. The diagram covers runs finished in the last 7 days: `full` holds the `plan_simplify`, `plan_review`, `task_review`, `simplify` and `final_review` steps of plan and Full runs, in that order, `small` the `task_review`, `simplify` and `final_review` steps of Small runs; `ran` counts steps, `findings` their findings (not the scoreboard's `found`, which counts steps that found something), `actedOn` per `splitFindings`; `fixChecks` counts `fix_check` and `final_fix_check` steps, those with `counts.open > 0`, and those with `round === 3`; schema 1 runs add to `beforeSteps` only. `warnings` on a diagram step stays 0 in slice 1 (warnings aren't tied to steps until CR4). Charts cover the last 12 weeks, oldest first. The feed holds the runs and the warnings whose `firstSeenAt` is after `seenAt`, newest first, at most 50. `coverageFrom` is the earliest `finishedAt` of the runs with `readable` true.

- [ ] **Step 1: Write the failing tests**

`home.test.ts` (units imported from the fixtures into a temp database, `now` fixed inside the fixture's week): `this week counts runs by path`; `last week is the week before`; `findings and cost sum the week's runs`; `cost is null when no run is priced`; `new warnings are those first seen after seenAt`; `the full diagram lists plan steps then implementation steps`; `the small diagram lists only its three steps`; `a schema 1 run only adds to beforeSteps`; `fix-checks count open and round 3`; `charts have 12 weeks oldest first`; `the feed is empty after the first import`; `the feed lists a new run and a new warning after a second import`; `coverageFrom is the earliest readable run` (after `report-later.json`, the Small run no longer counts); `weekSums matches the fixture's totals.weeks` (the fixture's `totals.weeks` is written to agree). In `check-real.test.ts`: `check:real reports a differing week` (a copy of the fixture with one week's cost changed prints `weeks: <n> compared, 1 differ` and that week's date). Back in `home.test.ts`: `no response field holds a slash-containing project or a transcript path` (serialize the response and check it contains no fixture `project` path and no `.jsonl`).

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run packages/server/test/home.test.ts packages/server/test/check-real.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `homeView`, `HomeResponse` and the route**

- [ ] **Step 4: Run it to verify it passes**

Same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server packages/shared
git commit -m "feat: home API with week numbers, diagram counts, charts and the feed"
```

### Task 7: The runs API

**Wave:** A

**Files:**
- Create: `packages/server/src/views/runs.ts`, `packages/shared/src/api/runs.ts`
- Modify: `packages/server/src/routes.ts` (adds the `GET /api/runs` and `GET /api/runs/:key` block only), `packages/shared/src/index.ts` (adds the `api/runs` export line only)
- Test: `packages/server/test/runs.test.ts`

**Interfaces:**
- Consumes: `listUnits`, `listWarnings` (Task 2); `registerRoutes` (Task 4); `runFacts`, `splitSessionId`, `weekStart` (Tasks 1 and 5).
- Produces: `RunsResponse = { runs: RunRow[]; projects: string[] }`, `RunRow = RunFacts` (Task 5's type, re-exported), with query `path`, `project`, `weeks` (default 4) and `warnings=1`, parsed into `RunsQuery = { path?: 'small' | 'full' | 'plan'; project?: string; weeks: number; warnings: boolean }`; newest first.
- Produces: `RunResponse = { facts: RunFacts; timeline: TimelineGroup[]; findings: FindingRow[]; skills: { name: string; outcome: string }[]; models: { model: string; cost: number | null }[]; advisor: { calls: number; notes: number } | null; warnings: { text: string; sessionId: string | null }[] }`, with `TimelineGroup = { kind: 'start' | 'plan' | 'wave' | 'task' | 'simplify' | 'final' | 'end'; label: string; at: string | null; tasks: { task: number; steps: TimelineStep[] }[]; steps: TimelineStep[] }`, `TimelineStep = { step: StepKind; round: number | null; agent: string | null; counts: Record<string, number>; findings: FindingRow[] }`, `FindingRow = { id: string | null; step: StepKind; task: number | null; wave: string | null; round: number | null; closedRound: number | null; severity: string | null; kind: string | null; summary: string | null; outcome: Outcome | null; reason: string | null; verdicts: string[] }`.
- Produces: `skillOutcomeLabel(outcome: unknown): string`: a string other than `'ran'` → `wrote a file` (never the path); `'ran'` → `ran`; an object with `applied` and `skipped` → `applied N, skipped M`; a list → `N results`; `true` → `record written`; `false` → `no record`; null → `–`.
- Produces: `runsList(runs: StoredUnit[], warnings: StoredWarning[], query: RunsQuery, now: Date): RunsResponse`, `runView(run: StoredUnit, warnings: StoredWarning[]): RunResponse`, and the two routes (`:key` URL-encoded; 404 for an unknown key).

The timeline is untimed (decision 30): `start` carries `record.started`, `end` carries `record.date`, every other group has `at` null. Groups in order: `plan` (plan steps), then for each entry of `waves` a `wave` group holding its tasks' steps and its wave-check steps (`step.wave` equal to the wave), then a `task` group for each task in no wave, then `simplify`, then `final` (`final_review` and `final_fix_check`). A schema 1 run gets `start`, `end` and a `final` group built from nothing (empty steps), with `facts.beforeSteps` true.

- [ ] **Step 1: Write the failing tests**

`runs.test.ts`: `lists runs newest first`; `filters by path`; `filters by project name`; `filters to runs with warnings`; `keeps the last 4 weeks by default`; `the Full run's timeline has two wave groups holding their tasks`; `a wave check sits in its wave`; `start and end carry the run's times and other groups none`; `the findings table flattens every step's findings`; `a schema 1 run has empty groups and beforeSteps`; `an unknown key is 404`; `a skill's path outcome shows as "wrote a file"`; `a warning's session ID comes as sessionId with {session} in the text`; `no response holds a transcript path, a project path or the fixture's spec path`.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run packages/server/test/runs.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `runsList`, `runView`, the types and the routes**

- [ ] **Step 4: Run it to verify it passes**

Same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server packages/shared
git commit -m "feat: runs list and run timeline API"
```

### Task 8: The web shell, the status banner and the test harness

**Files:**
- Create: `packages/web/package.json`, `packages/web/vite.config.ts`, `packages/web/index.html`, `packages/web/tsconfig.json`, `packages/web/src/main.tsx`, `packages/web/src/router.tsx`, `packages/web/src/api.ts`, `packages/web/src/layout/Shell.tsx`, `packages/web/src/layout/Menu.tsx`, `packages/web/src/layout/StatusBanner.tsx`, `packages/web/src/layout/RefreshButton.tsx`, `packages/web/src/components/SessionChip.tsx`, Tailwind and shadcn/ui setup files, and the shadcn/ui components Tasks 9 and 10 both use (`button`, `tabs`, `table`, `badge`, `card`) in `packages/web/src/components/ui/`
- Create: `packages/web/.storybook/` config, `packages/web/src/layout/*.stories.tsx`
- Create: `packages/web/playwright.config.ts`, `packages/web/e2e/shell.spec.ts`, root script `test:screens`
- Test: the stories' interaction tests, `packages/web/e2e/shell.spec.ts`

**Interfaces:**
- Consumes: `StatusResponse` (Task 4); `dev:fixtures` (Task 4).
- Produces: `useStatus()` (TanStack Query on `/api/status`, refetched every 10 s); `useLiveQuery<T>(path: string)`, a query whose key includes `lastGoodImportAt`, so data refetches in place when an import lands; `refresh(): Promise<void>` (POST with `X-Dashboard-Refresh: 1`).
- Produces: `SessionChip({ id }: { id: string })`: the session's name (the ID's first 8 characters until the reporter gives a title, CR9), the full ID in a tooltip on hover and focus, and a copy icon button beside it (`aria-label` "Copy session ID") that copies the full ID and confirms "Copied". Also `WarningText({ text, sessionId })`, which renders `{session}` as a `SessionChip`.
- Produces: `Shell` with the menu (Home and Runs only; later entries hidden), the banner and the refresh button; the router with `/` and `/runs` placeholders that Tasks 9 and 10 replace.
- Produces: Playwright projects `checks` (axe and behaviour, anywhere) and `screens` (screenshots, container only), both starting `dev:fixtures` as `webServer`.

Vite proxies `/api` to the server in development with `changeOrigin` and an `Origin` rewritten to the server's, so the request rules hold in development too; production builds go to `packages/web/dist`, which `main.ts` serves. Playwright's `webServer` builds `web` first, then runs `dev:fixtures`, and tests against the Hono server.

- [ ] **Step 1: Write the failing tests**

Stories with interaction tests: `StatusBanner` (ok: shows nothing; failure: says the last attempt failed at its time with the error, and that the data is from the last good import at its time; never imported: says so) and `RefreshButton` (idle, importing; clicking sends one POST with the header); `SessionChip` (shows 8 characters; hovering shows the full ID; the copy button puts the full ID on the clipboard and says "Copied"); `WarningText` (a text with `{session}` renders the chip in place). `shell.spec.ts`: `the shell has no axe violations` (`checks`).

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run packages/web/src/layout`
Expected: FAIL.

- [ ] **Step 3: Implement the shell, the hooks, the banner, the button, the stories and the Playwright config; record shadcn/ui in `CLAUDE.md` `## Stack` if its line changes**

- [ ] **Step 4: Run them to verify they pass, then the browser checks**

Run: `pnpm vitest run packages/web/src/layout` then `pnpm --filter @cwd/web exec playwright test --project checks`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web package.json pnpm-lock.yaml CLAUDE.md
git commit -m "feat: web shell with live status, refresh and the test harness"
```

### Task 9: The home screen

**Wave:** B

**Files:**
- Create: `packages/web/src/home/HomePage.tsx`, `WeekTiles.tsx`, `WorkflowDiagram.tsx`, `WeeklyCharts.tsx`, `Feed.tsx`, and a `.stories.tsx` for each component
- Modify: `packages/web/src/router.tsx` (replaces the `/` placeholder only)
- Test: the stories' interaction tests, `packages/web/e2e/home.spec.ts`

**Interfaces:**
- Consumes: `HomeResponse` (Task 6); `useLiveQuery`, `Shell`, `WarningText` (Task 8).
- Produces: the home route.

Layout per decision 22 and `docs/design/2026-11-09-live-dashboard/home.html`: four tiles on top, each against last week ("19 findings · 13 acted on · 1 open"); the diagram with two tabs (Full, Small) in React Flow, step boxes carrying `ran`, `findings` and `actedOn`, the fix-check line under it, and "N runs before steps" when `beforeSteps > 0`; three weekly charts (ECharts) below, with a note when `coverageFrom` falls after the first charted week ("Weeks before <coverageFrom> show what was stored; the reporter can no longer read them"); the feed on the right, warnings through `WarningText`, with "Mark all seen" (`POST /api/seen` with the refresh header, then refetch).

- [ ] **Step 1: Write the failing tests**

Stories with interaction tests: `WeekTiles` (empty week, full week, cost unknown shows "–"); `WeeklyCharts` (the coverage note shown only when `coverageFrom` is after the first week); `WorkflowDiagram` (switching to Small shows three boxes; before-steps note shown); `Feed` (empty says nothing new; `Mark all seen` sends one POST and empties the list). `home.spec.ts` on `dev:fixtures`: `home has no axe violations`; `a summary with HTML shows as text` (fixture text `<img src=x onerror=alert(1)>` is visible as text in the feed and no `img[src="x"]` exists); `home matches its screenshot` (`screens`).

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run packages/web/src/home`
Expected: FAIL.

- [ ] **Step 3: Implement the components and the page, with the `dataviz` skill loaded for the charts**

- [ ] **Step 4: Run them to verify they pass, then the browser checks**

Run: `pnpm vitest run packages/web/src/home` then `pnpm --filter @cwd/web exec playwright test --project checks e2e/home.spec.ts` then `pnpm test:screens`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat: home screen with tiles, workflow diagram, weekly charts and feed"
```

### Task 10: The Runs list and one run

**Wave:** B

**Files:**
- Create: `packages/web/src/runs/RunsPage.tsx`, `RunsTable.tsx`, `RunPage.tsx`, `RunTimeline.tsx`, `FindingsTable.tsx`, and a `.stories.tsx` for each component
- Modify: `packages/web/src/router.tsx` (replaces the `/runs` placeholder and adds `/runs/$key` only)
- Test: the stories' interaction tests, `packages/web/e2e/runs.spec.ts`

**Interfaces:**
- Consumes: `RunsResponse`, `RunResponse` (Task 7); `useLiveQuery`, `Shell`, `WarningText` (Task 8).
- Produces: the `/runs` and `/runs/$key` routes.

Layout per decision 26 and 30 and `docs/design/2026-11-09-live-dashboard/runs-and-run.html`: the list with its filters (path, project, period, has warnings) and columns, "–" and a "before steps" mark for schema 1 runs; the run page with its header, the untimed timeline (waves side by side, each step opening its findings) and a toggle to the findings table (TanStack Table, filter by step, severity and outcome). Skills, models, advisor and warnings (through `WarningText`) show for the run as a whole.

- [ ] **Step 1: Write the failing tests**

Stories with interaction tests: `RunsTable` (empty, full; the `Has warnings` filter hides runs without), `RunTimeline` (two waves side by side; opening a step shows its findings; a schema 1 run shows the before-steps note), `FindingsTable` (filtering by outcome `ruled` leaves one row with its reason). `runs.spec.ts`: `runs list and run page have no axe violations`; `a branch with HTML shows as text`; `the toggle switches between timeline and findings`; both pages `match their screenshots` (`screens`).

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run packages/web/src/runs`
Expected: FAIL.

- [ ] **Step 3: Implement the components and the pages**

- [ ] **Step 4: Run them to verify they pass, then the browser checks**

Run: `pnpm vitest run packages/web/src/runs` then `pnpm --filter @cwd/web exec playwright test --project checks e2e/runs.spec.ts` then `pnpm test:screens`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat: runs list and run page with untimed timeline and findings table"
```

### Task 11: The launch agent, CI and the README

**Files:**
- Create: `packages/server/src/agent.ts`, `.github/workflows/ci.yml`, `README.md`
- Modify: `package.json` (scripts `build`, `agent:install`, `agent:uninstall`)
- Test: `packages/server/test/agent.test.ts`

**Interfaces:**
- Consumes: `loadConfig` (Task 3); `main.ts` (Task 4).
- Produces: `plist(opts: { label: string; node: string; entry: string; logDir: string }): string` and the CLI `agent.ts install | uninstall`. Label `com.shoklah.claude-workflow-dashboard`; the plist goes to `~/Library/LaunchAgents/<label>.plist`, runs `node <repo>/packages/server/dist/main.js` with `RunAtLoad` and `KeepAlive` true, and logs to `<dataDir>/logs/`. `install` writes it and runs `launchctl bootstrap gui/<uid> <plist>`; `uninstall` runs `launchctl bootout gui/<uid>/<label>` and deletes the file.

CI on `ubuntu-latest`, on push and pull request: `pnpm install --frozen-lockfile`, type check, `pnpm build`, `pnpm vitest run`, the Storybook tests, the Playwright `checks` project, then the `screens` project inside the pinned Playwright container. Fixtures only; no secret, no network beyond installing packages.

The README is public and personal-data free: what the app is, a screenshot from the `screens` baselines (invented data), install (`pnpm install`, `pnpm build`, `pnpm agent:install`), the data folder, `check:real`, and that it needs the workflow's reporter installed.


- [ ] **Step 1: Write the failing test**

`agent.test.ts`: `the plist runs node on the built entry`; `the plist sets RunAtLoad and KeepAlive`; `the plist logs into the data dir`; `the plist escapes a path with spaces and ampersands` (an entry under `Application Support & co` is valid XML).

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run packages/server/test/agent.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `agent.ts`, the scripts, `ci.yml` and the README**

- [ ] **Step 4: Run it to verify it passes, then the whole suite**

Run: `pnpm vitest run` then `pnpm --filter @cwd/web exec playwright test --project checks`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server package.json .github README.md
git commit -m "feat: launch agent, CI on fixtures and the README"
```

## After the last task

The owner runs `pnpm --filter @cwd/server check:real` on the Mac. `fields: none` and `run keys: 0 duplicates, 0 missing` mean slice 1 can run on real data; any duplicate or missing key stops the run for CR7 (spec, "Left to the builder").
