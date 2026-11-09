# Live dashboard, slice 2a ("Findings and showing") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every stored finding gets a category and a relevance call from the app's labeller (Claude Haiku 5.5 over the Anthropic API, with the owner's key). A Findings page shows them by category and week. Showing mode filters every API response down to the projects the owner picks.

**Architecture:** Projects get an identity: the full path, with worktrees folded in, behind a hashed key. The labeller is a second background queue after each import. It labels each finding's trimmed text and stores the labels as facts beside the raw exports. Showing mode is server state. One scope helper applies it inside each view function, and the views' tests and `check:real` run leak checks against it. The web app gets the Findings page (a heatmap table), new columns on the run page's findings table, and the showing switch in the header.

**Tech Stack:** As slice 1 (Node, TypeScript, Hono, Drizzle over `better-sqlite3`, zod, React, Vite, TanStack Query, Router and Table, Tailwind, shadcn/ui, Vitest, Storybook, Playwright, axe), plus `@anthropic-ai/sdk`.

**Spec:** `docs/superpowers/specs/2026-11-09-live-dashboard-design.md`: "Slice 2 design", the 2a sections, decisions 35–48 and the slice 2 entries under "Claude's calls". Mockups: `docs/design/2026-11-09-slice-2/findings.html` (layout B) and `basics-and-showing.html` (the showing mode part).

## Global Constraints

- **Read no real data.** That means no `~/.claude`, no real data dir and no reporter run, except `check:real`, which only the owner runs. Fixtures are invented. No test calls the Anthropic API: the label client is injected and stubbed.
- **The key and the labeller's settings** live only in `<dataDir>/.env`, which `main.ts` loads with `process.loadEnvFile` when it exists. They are `ANTHROPIC_API_KEY`, `LABELLER_MODEL` (default `claude-haiku-5-5`) and `LABELLER_DAILY_MAX` (default `500`). With no key, the labeller is off. The key never reaches the repo, a fixture, a log or an error text.
- **The category list is exactly the spec's,** at version `1`:
  - plan: `scope`, `task split and order`, `spec gap`, `risk missed`, `test plan`
  - implementation: `correctness`, `error handling`, `data safety`, `security and privacy`, `reuse and duplication`, `conventions`, `simplicity`, `tests`, `naming and clarity`, `performance`, `docs`
  - Display labels may add the spec's parentheses: "scope (missing or extra work)", "simplicity (over-building)".
- **Relevance values** are exactly `valid`, `invalid` and `unclear`.
- **Areas:**
  - `plan_simplify` and `plan_review` are `plan`
  - `task_review`, `fix_check`, `final_review` and `final_fix_check` are `implementation`
  - `simplify` is `cleanup`, labelled from the implementation list
- **Labelling:** batches of `25` findings. A label is keyed by run key, finding id and input hash. Labels show for the list version and input hash they match; pending means no label from the configured model. A finding with no id is never labelled.
- **Labels and label batches are stored facts.** A migration that drops or recreates their tables carries their rows over.
- **Showing mode:**
  - It lives in `state` (name `showing`, a JSON array of project keys). With it on, no response holds an absolute path, a session ID, or a hidden project's name, path or branch.
  - Hidden projects count only in sums.
  - A picked project shows as its alias from `config.json`'s `aliases` (keyed by project root path), else its folder name. Two shown names that are equal get ` (<parent folder>)` appended.
- **A project** is its root: the record's `project` with a trailing `/.claude/worktrees/<name>` removed. Its key is `hash(root)`, the same 16-hex SHA-256 as the run keys. A session belongs to a project when its transcript folder equals the project's encoded root, or starts with it followed by `--claude-worktrees-`, and exactly one project matches. The encoding turns every character other than an ASCII letter or digit into `-`.
- **Slice 1's rules hold:**
  - the request rules live only in `createApp`'s middleware
  - routes go in `registerRoutes`, one block per task
  - a page's response is built by a pure view in `packages/server/src/views/`
  - relative imports carry `.ts`
  - `@cwd/shared` imports no `node:` module
  - migrations come from `drizzle-kit generate` only
  - stories stub the API with `mockApi`
  - e2e tests pin the clock with `pinClock`
  - display formatting lives in `packages/web/src/lib/format.ts`
- **Failing-test check,** after each task: `/usr/bin/python3 -I ~/.claude/scripts/failing-test-check.py --base <task start SHA> --link node_modules --link packages/shared/node_modules --link packages/server/node_modules --link packages/web/node_modules --timeout 240 -- pnpm vitest run <the task's test files>`, with a `--test-file` for each of the task's test files.
- **Commit messages** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A hidden project's name inside a shown project's text** (a finding summary naming `tidepool-api`, or holding `/Users/example/Work/tidepool-api/src/x.ts`): masked as "another project". Only whole path segments and whole words are replaced, so `api` inside "rapid" stays. Pinned in Task 3.
2. **The model's reply is malformed,** names a category outside the finding's area, or the API throws (429, overloaded): nothing from that batch is stored, the queue logs it, and the next import retries. Pinned in Task 4.
3. **Showing mode across a restart,** and a `POST /api/showing` naming a key that isn't stored: the mode survives reopening the database, and an unknown key answers 400 with the mode unchanged. Pinned in Task 3.
4. **Project roots:** a path with a space or a trailing `/`, a worktree path, and two roots with the same folder name. Pinned in Task 1.
5. **Showing mode is server-wide state,** so a browser test that turns it on must not overlap another test. Playwright runs with `workers: 1`, and the showing spec stops the mode in `afterEach`. Pinned in Task 6.

---

### Task 1: Projects: root, key, names, and the Runs filter by key

**Wave:** A

**Files:**
- Create: `packages/shared/src/projects.ts`
- Create: `packages/shared/fixtures/report-projects.json`
- Create: `packages/shared/test/projects.test.ts`
- Modify: `packages/shared/src/index.ts` (one export line)
- Modify: `packages/shared/src/facts.ts` (`RunFacts` gains `projectKey`, and `runFacts`' `project` uses the root)
- Modify: `packages/shared/src/api/runs.ts` (`RunsQuery.project` is a key, `RunsResponse.projects` gets the new shape)
- Modify: `packages/server/src/keys.ts` (adds `projectKey`)
- Modify: `packages/server/src/views/runs.ts` (`storedFacts`, `runsList`'s project filter and list)
- Modify: `packages/server/src/views/home.ts` (uses `storedFacts`)
- Modify: `packages/server/test/runs.test.ts`
- Modify: `packages/server/test/keys.test.ts`
- Modify: `packages/web/src/runs/RunsPage.tsx` (the project select uses keys)
- Modify: `packages/web/src/test/runs.ts`
- Modify: `packages/web/src/runs/RunsPage.stories.tsx`

**Interfaces:**
- Produces (shared, `projects.ts`):
  - `projectRoot(path: string): string`
  - `transcriptFolder(root: string): string`
  - `sessionProject(file: string, roots: string[]): string | null`, returning the matching root, or null for no match or more than one
  - `projectNames(roots: string[]): Map<string, string>`, mapping each root to its folder name, with ` (<parent>)` appended where names collide
- Produces (server):
  - `projectKey(root: string): string` in `keys.ts`
  - `storedFacts(unit: StoredUnit<RunEntry>, names: Map<string, string>): RunFacts` in `views/runs.ts`
- Changes:
  - `RunFacts` gains `projectKey: string`. `runFacts` returns `Omit<RunFacts, 'key' | 'projectKey'>`, its `project` being the last segment of `projectRoot(record.project)`. `storedFacts` overrides it with the name from `names`.
  - `RunsQuery.project` is a project key.
  - `RunsResponse.projects` becomes `{ key: string; name: string }[]`, sorted by name.

The fixture is a version 1 report, invented, whose `totals.weeks` agree with its runs (the fixture convention). It holds:
- a run in `/Users/example/Work/lantern-notes`
- a run in `/Users/example/Work/lantern-notes/.claude/worktrees/brave-otter`
- a run in `/Users/example/Archive/lantern-notes`
- a run in `/Users/example/Work/tidepool-api`, whose finding summary names `lantern-notes` and holds `/Users/example/Work/lantern-notes/src/sync.ts`
- findings in every area, one without an `id`
- sessions in `-Users-example-Work-lantern-notes`, `-Users-example-Work-lantern-notes--claude-worktrees-brave-otter` and `-Users-example-Work-quarry`
- a session warning holding its own `<uuid>.jsonl`

- [ ] **Step 1: Write the failing tests** in `packages/shared/test/projects.test.ts`:
  - `projectRoot('/Users/example/Work/lantern-notes/.claude/worktrees/brave-otter')` is `'/Users/example/Work/lantern-notes'`.
  - `projectRoot('/Users/example/My Work/app/')` is `'/Users/example/My Work/app'`.
  - `transcriptFolder('/Users/example/Work/lantern-notes')` is `'-Users-example-Work-lantern-notes'`.
  - `sessionProject` matches the plain folder and the `--claude-worktrees-` folder to the lantern-notes root, and gives null for `-Users-example-Work-quarry`.
  - When two roots encode the same way (`/Users/example/Work/my-app` and `/Users/example/Work/my/app`), `sessionProject` gives null.
  - `projectNames` of both lantern-notes roots gives `lantern-notes (Work)` and `lantern-notes (Archive)`.

  In `packages/server/test/runs.test.ts`, on `report-projects`:
  - The worktree run's row has the main lantern-notes root's `projectKey`.
  - `GET /api/runs?project=<key>&weeks=52` returns only that project's two runs.
  - `projects` lists three entries with distinct names.

  In `keys.test.ts`: `projectKey` is 16 hex characters and never contains `/`.
- [ ] **Step 2: Run** `pnpm vitest run packages/shared/test/projects.test.ts packages/server/test/runs.test.ts packages/server/test/keys.test.ts`. Expected: FAIL, because `projectRoot` is not exported.
- [ ] **Step 3: Implement** the interfaces above. `homeView` and `runsList` build `names` once from every stored run's root and use `storedFacts`. `RunsPage` sends the selected key and shows `name`. Update `test/runs.ts`'s `runsFull.projects` to the new shape.
- [ ] **Step 4: Run** the command from Step 2, then `pnpm vitest run packages/web/src/runs` and `pnpm typecheck`. Expected: PASS. Slice 1's existing tests still pass, with their expectations updated only where `projects` changed shape.
- [ ] **Step 5: Commit** with `feat: a project is its root behind a key; worktrees fold in; the Runs filter uses the key`.

Conventions line for the report: a project is its root behind `projectKey`, and API responses carry the key and a display name, never the path.

### Task 2: Category list and stored labels

**Wave:** A

**Files:**
- Create: `packages/shared/src/categories.ts`
- Create: `packages/shared/test/categories.test.ts`
- Modify: `packages/shared/src/index.ts` (one export line)
- Create: `packages/server/src/text.ts` (`trimPaths` moves here from `routes.ts`)
- Modify: `packages/server/src/routes.ts` (imports `trimPaths`; no other change)
- Modify: `packages/server/src/db/schema.ts` (adds two tables)
- Create: the generated migration in `packages/server/drizzle/`
- Create: `packages/server/src/db/labels.ts`
- Create: `packages/server/test/labels.test.ts`

**Interfaces:**
- Produces (shared):
  - `CATEGORY_LIST_VERSION = 1`
  - `AREAS = ['plan', 'implementation', 'cleanup'] as const`, with `type Area`
  - `CATEGORIES: Record<'plan' | 'implementation', readonly string[]>`
  - `CATEGORY_LABELS: Record<string, string>`
  - `RELEVANCE = ['valid', 'invalid', 'unclear'] as const`, with `type Relevance`
  - `areaOf(step: StepKind): Area`
  - `categoriesOf(area: Area): readonly string[]`, with cleanup giving the implementation list
- Produces (server):
  - `trimPaths(text: string): string` in `text.ts`
  - tables `findingLabels`, with columns `run_key`, `finding_id`, `input_hash`, `list_version`, `model`, `category`, `relevance`, `reason` and `labelled_at` (`timestamp_ms`), and a primary key over the first five
  - table `labelBatches`, with columns `id`, `at`, `model`, `count`, `input_tokens` and `output_tokens`
  - in `db/labels.ts`:
    - `type LabelInput = { runKey: string; findingId: string; area: Area; text: string; hash: string }`
    - `labelInputs(runs: StoredUnit<RunEntry>[]): LabelInput[]`
    - `type StoredLabel = { runKey: string; findingId: string; hash: string; model: string; category: string; relevance: Relevance; reason: string; labelledAt: Date }`
    - `currentLabels(db: Db, inputs: LabelInput[]): Map<string, StoredLabel>`, keyed `` `${runKey} ${findingId}` ``: the latest label at the current list version whose hash is the input's
    - `pendingInputs(db: Db, inputs: LabelInput[], model: string): LabelInput[]`
    - `saveBatch(db: Db, labels: StoredLabel[], usage: { at: Date; model: string; inputTokens: number; outputTokens: number }): void`, in one transaction
    - `labelledOn(db: Db, day: Date): number`, counting labels whose `labelled_at` falls on that UTC day
    - `tokensSince(db: Db, from: Date): { input: number; output: number }`

`labelInputs` skips findings with no `id` and steps with no kind. Each input's `text` is `JSON.stringify({ step, severity, kind, summary, outcome, reason, verdicts })`, with every string passed through `trimPaths`. Its `hash` is the first 16 hex characters of that text's SHA-256.

- [ ] **Step 1: Write the failing tests.**
  - `categories.test.ts`: `areaOf('simplify')` is `'cleanup'`, `categoriesOf('cleanup')` equals `CATEGORIES.implementation`, `areaOf('plan_review')` is `'plan'`, and the lists are exactly the Global Constraints' strings.
  - `labels.test.ts`, on a fresh database with `report-projects` imported:
    - `labelInputs` leaves out the finding with no id.
    - No input `text` contains `/Users/`.
    - After `saveBatch` with one label, `currentLabels` holds it, and `pendingInputs` no longer lists it for the same model but lists it for another model.
    - Re-importing the run with that finding's summary changed makes `currentLabels` drop it and `pendingInputs` list it again.
    - `labelledOn` counts it on its day and not the next.
    - `tokensSince` sums the batch's tokens.
- [ ] **Step 2: Run** `pnpm vitest run packages/shared/test/categories.test.ts packages/server/test/labels.test.ts`. Expected: FAIL, because the modules don't exist.
- [ ] **Step 3: Implement.** Move `trimPaths` with its regex and comment unchanged. Add the tables, then run `pnpm --filter @cwd/server db:generate` and commit the generated SQL and meta unedited.
- [ ] **Step 4: Run** the command from Step 2, plus `pnpm vitest run packages/server` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat: the category list and stored finding labels; trimPaths moves to text.ts`.

Conventions lines for the report:
- The error-text line now names `trimPaths` in `packages/server/src/text.ts`.
- The labels convention: labels are written only through `saveBatch`, and read through `currentLabels`.

### Task 3: Showing mode on the server

**Wave:** B

**Files:**
- Create: `packages/shared/src/api/showing.ts`
- Modify: `packages/shared/src/index.ts` (one export line)
- Create: `packages/server/src/views/scope.ts`
- Modify: `packages/server/src/db/read.ts` (adds `getShowing` and `setShowing`)
- Modify: `packages/server/src/config.ts` (`aliases`)
- Modify: `packages/server/src/app.ts` (`AppDeps.aliases`)
- Modify: `packages/server/src/main.ts` (the `serveApp` call only)
- Modify: `packages/server/src/dev-fixtures.ts` (the `serveApp` call only)
- Modify: `packages/server/src/routes.ts` (a showing block, plus `scope` passed to the home, runs and run views)
- Modify: `packages/server/src/views/home.ts`
- Modify: `packages/server/src/views/runs.ts`
- Modify: every test that builds `AppDeps` (adds `aliases: {}`)
- Create: `packages/server/test/leak.ts`
- Create: `packages/server/test/showing.test.ts`
- Modify: `README.md` (an "Aliases" note under the data folder)

**Interfaces:**
- Consumes: `projectRoot`, `projectNames`, `sessionProject`, `projectKey`, `storedFacts` (Task 1); `trimPaths` (Task 2).
- Produces (shared):
  - `type ShowingResponse = { on: boolean; projects: { key: string; name: string; picked: boolean }[] }`
  - `type ShowingRequest = { projects: string[] }`
- Produces (server):
  - `getShowing(db: Db): string[] | null` and `setShowing(db: Db, projects: string[] | null): void`, where null deletes the state row
  - `Config.aliases: Record<string, string>`, default `{}`
  - in `views/scope.ts`:
    - `type Scope = { shown: Set<string>; names: Map<string, string>; hidden: string[] }`, mapping project key to alias or name; `hidden` holds the hidden projects' roots and folder names
    - `scopeOf(showing: string[] | null, roots: string[], aliases: Record<string, string>): Scope | null`
    - `maskText(scope: Scope, text: string): string`, which runs `trimPaths`, then turns each whole-word or whole-segment hidden name into `another project`, then turns any `<uuid>.jsonl` into `a session`
- Changes:
  - `homeView`'s input gains `sessions: StoredUnit<SessionEntry>[]` and `scope: Scope | null`.
  - `runsList` gains a final `scope: Scope | null`, and `RunsResponse` gains `hidden: number`.
  - `runView` gains `scope: Scope | null` and returns `RunResponse | null`, with null for a hidden run, which the route answers 404.

With a scope:
- Rows, feed items, warnings and the Runs list's `projects` keep only shown projects. Session warnings stay only when `sessionProject` maps their session to a shown root.
- `project` is the scope's name.
- Every text goes through `maskText`, and every `sessionId` is null.
- Sums, tiles, charts and the diagram still count every run.

The showing route block:
- `GET /api/showing` answers `ShowingResponse`, listing every stored project's key and name.
- `POST /api/showing` takes a `ShowingRequest`. An empty list stops showing. A key that isn't stored answers 400, with the state unchanged.
- Any other method answers with `postOnly`'s 405 plus `Allow: GET, POST`.

- [ ] **Step 1: Write the failing tests.**
  - `test/leak.ts` exports `leaks(json: unknown, forbidden: string[]): string[]`, which returns the forbidden strings found in `JSON.stringify(json)`.
  - In `showing.test.ts`, on `report-projects`, with showing set to the lantern-notes (Work) key and its alias `Notes app`:
    - `leaks` of `/api/home`, `/api/runs?weeks=52` and each shown run's `/api/runs/:key` is empty against these strings: `/Users/example`, `tidepool-api`, the Archive lantern-notes branch, and every session UUID in the fixture.
    - `/api/runs` has `hidden` equal to 2 and every row's `project` is `Notes app`.
    - The tidepool run's page answers 404.
    - The tidepool run's finding text, read through `maskText`, contains `another project` and no `/Users/`, and "rapid" stays "rapid".
    - The home tiles' runs count equals the count with showing off.
  - Further cases:
    - `POST /api/showing` with an unknown key answers 400 and `getShowing` is unchanged.
    - After closing and reopening the database file, `getShowing` still gives the key.
    - An empty list turns the mode off.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/showing.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces. The routes build the scope from `getShowing`, the stored runs' roots and `deps.aliases`.
- [ ] **Step 4: Run** `pnpm vitest run packages/server` and `pnpm typecheck`. Expected: PASS, with slice 1's tests passing `scope: null`.
- [ ] **Step 5: Commit** with `feat: showing mode on the server: state, the scope helper in every view, leak checks`.

Conventions line for the report: showing mode's scope is server state, applied by `scopeOf` and `maskText` in `views/scope.ts`, with the leak check in `test/leak.ts`. This names the helpers in the line that `CLAUDE.md` already holds.

### Task 4: The labeller

**Wave:** B

**Files:**
- Create: `packages/server/src/labeller.ts`
- Create: `packages/server/test/labeller.test.ts`
- Modify: `packages/server/src/main.ts` (env loading and the label queue, not the `serveApp` call)
- Modify: `packages/server/package.json` (`@anthropic-ai/sdk`, pinned)
- Modify: `pnpm-lock.yaml`
- Create: `.env.example`
- Modify: `README.md` (a "Finding labels" section)

**Interfaces:**
- Consumes: `LabelInput`, `labelInputs`, `pendingInputs`, `saveBatch`, `labelledOn`, `categoriesOf`, `RELEVANCE` and `CATEGORY_LIST_VERSION` (Task 2).
- Produces, all in `labeller.ts`:
  - `type LabelClient = (batch: { id: string; area: Area; text: string }[]) => Promise<{ results: { id: string; category: string; relevance: Relevance; reason: string }[]; inputTokens: number; outputTokens: number }>`
  - `labellerSettings(env: Record<string, string | undefined>): { model: string; dailyMax: number } | null`, which is null when `ANTHROPIC_API_KEY` is empty or missing
  - `anthropicLabelClient(model: string): LabelClient`
  - `labelPending(db: Db, client: LabelClient, settings: { model: string; dailyMax: number }, now: Date): Promise<void>`

`labelPending`:
- Takes `pendingInputs` for the model.
- Limits them to `dailyMax - labelledOn(now)`.
- Sends them in batches of 25, with ids `f1` to `f25`.
- Keeps only results whose category is in `categoriesOf(input.area)` and whose relevance is in `RELEVANCE`.
- Saves each batch through `saveBatch`.
- On a throw, it stops and rethrows, so the queue logs it.

`anthropicLabelClient`:
- Uses `new Anthropic()`, which reads `ANTHROPIC_API_KEY`, and `client.messages.create`.
- Sends `max_tokens: 4096` and `output_config: { format: { type: 'json_schema', schema } }`. The schema is an object with `labels`: an array of `{ id, category (an enum of every category), relevance (an enum of RELEVANCE), reason (a string) }`, with `additionalProperties: false`.
- Parses the text block with a local zod schema, and takes tokens from `response.usage`.
- Its prompt says: a finding comes from a code review step in an agentic workflow; pick one category from the area's list; judge whether the finding was a real problem worth raising (valid), not one (invalid), or can't tell (unclear); give a reason in one sentence.

Before writing the SDK call, check its shape against the `claude-api` skill.

`main.ts`:
- If `<dataDir>/.env` exists, calls `process.loadEnvFile` on it.
- When settings exist, creates a second `createQueue` for `labelPending` with the real client.
- The import queue's job becomes `async () => { await importOnce(db, config, now); labels?.request(); }`.

`.env.example` lists the three variables with no values and a comment naming the data folder.

- [ ] **Step 1: Write the failing tests** in `labeller.test.ts`, with a stub `LabelClient` that records each batch's size and answers with valid labels:
  - With 60 pending findings and `dailyMax` 500, the batches are 25, 25 and 10, and 60 labels are stored.
  - With `dailyMax` 30, 30 are stored and a second run on the same day stores none.
  - A result whose category is outside its area (`correctness` for a plan finding) is not stored.
  - A client that throws stores nothing from that batch, and `labelPending` rejects.
  - `labellerSettings({})` is null.
  - `labellerSettings({ ANTHROPIC_API_KEY: 'k' })` is `{ model: 'claude-haiku-5-5', dailyMax: 500 }`.
  - `LABELLER_DAILY_MAX: '40'` gives 40.
  - No batch text the stub receives contains `/Users/`.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/labeller.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces and the wiring. Add the SDK at its latest stable version, pinned.
- [ ] **Step 4: Run** `pnpm vitest run packages/server` and `pnpm typecheck`. Expected: PASS. `grep -r "ANTHROPIC_API_KEY=" --include='*' . --exclude-dir=node_modules` finds only `.env.example`'s empty line.
- [ ] **Step 5: Commit** with `feat: the labeller labels each finding's text with a category and a relevance call, in batches, under a daily cap`.

Stack line for the report, to go under `## Stack` in `CLAUDE.md`: `@anthropic-ai/sdk` for the labeller's calls, through the official SDK.

### Task 5: The Findings API

**Wave:** C

**Files:**
- Create: `packages/shared/src/api/findings.ts`
- Modify: `packages/shared/src/index.ts` (one export line)
- Create: `packages/server/src/views/findings.ts`
- Modify: `packages/server/src/routes.ts` (a findings block)
- Modify: `packages/server/src/app.ts` (`AppDeps.labeller: { model: string } | null`)
- Modify: `packages/server/src/main.ts` (passes `labeller`)
- Modify: `packages/server/src/dev-fixtures.ts` (passes `labeller: null`)
- Modify: every test that builds `AppDeps` (adds `labeller: null`)
- Create: `packages/server/test/findings.test.ts`

**Interfaces:**
- Consumes: Tasks 2 and 3 (`labelInputs`, `currentLabels`, `pendingInputs`, `labelledOn`, `tokensSince`, `Scope`, `maskText`), and `storedFacts` (Task 1).
- Produces (shared):
  - `type FindingCell = { raised: number; actedOn: number; notActedOn: number; open: number; valid: number; invalid: number; unclear: number; byApp: number }`
  - `type FindingsRow = { area: Area; category: string | null; cells: FindingCell[] }`, where a null category is the "unlabelled" row
  - `type FindingItem = { runKey: string; run: string; week: string; area: Area; category: string | null; step: StepKind; summary: string | null; outcome: Outcome | null; relevance: Relevance | null; reason: string | null; judge: 'app' | null }`
  - `type FindingsQuery = { weeks: number; path?: Path; project?: string }`
  - `type FindingsResponse = { weeks: string[]; rows: FindingsRow[]; findings: FindingItem[]; hidden: number; signals: { laterFixes: number; finalAfterClean: number; notProportionate: number; declinedOrRuled: number }; labeller: { on: boolean; labelled: number; waiting: number; tokensThisWeek: { input: number; output: number } } }`
- Produces (server): `findingsView(input: { runs: StoredUnit<RunEntry>[]; labels: Map<string, StoredLabel>; query: FindingsQuery; now: Date; scope: Scope | null; labeller: FindingsResponse['labeller'] }): FindingsResponse`.

The view, all sums over stored runs:
- **Weeks:** `query.weeks` weeks ending this week, oldest first. A finding's week is `weekOf` of its run's finish time.
- **Rows:** every area, then every category of `categoriesOf(area)`, plus an unlabelled row per area when any finding there has no label.
- **Counts:** acted on, not acted on and open follow `splitFindings`' definitions.
- **Relevance:** `valid`, `invalid` and `unclear` come from the label. `byApp` counts the labelled findings, all of them the app's until CR10.
- **Signals:**
  - `laterFixes`: the period's runs' `later_fixes` length
  - `finalAfterClean`: final-review findings in runs whose `task_review` steps all have zero findings, with at least one such step
  - `notProportionate`: the sum of `fix_check` and `final_fix_check` `counts.not_proportionate`
  - `declinedOrRuled`: findings declined or ruled
- **With a scope:** cells count every project, but `findings` lists only shown projects' findings, with `maskText` applied to `summary` and `reason`. `hidden` is the number of findings left out.

The route:
- `GET /api/findings` parses `weeks` (default 8), `path` and `project` (a key).
- `labeller.on` is `deps.labeller !== null`.
- `labelled` is the size of `currentLabels`.
- `waiting` is the number of `pendingInputs` for the model, 0 when off.
- `tokensThisWeek` is `tokensSince(weekStart(now))`.

- [ ] **Step 1: Write the failing tests** in `findings.test.ts`, on `report-projects` with labels saved through `saveBatch`:
  - `rows` starts with the plan area's five categories in the list's order.
  - A labelled `tests` finding counts in its week's `tests` cell, with `byApp` 1.
  - An unlabelled finding lands in its area's unlabelled row.
  - A finding with no id lands in its area's unlabelled row too.
  - `signals.finalAfterClean` equals the fixture's count.
  - With a scope on lantern-notes (Work): `findings` holds no tidepool item, `hidden` counts them, the cells still include them, and `leaks` against `/Users/example` and `tidepool-api` is empty.
  - `labeller` is `{ on: false, labelled: <n>, waiting: 0, ... }` when `deps.labeller` is null.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/findings.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run packages/server` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat: GET /api/findings: findings by category and week, relevance signals, the labeller's state`.

### Task 6: Showing mode in the web app

**Wave:** C

**Files:**
- Modify: `packages/web/src/api.ts` (`useShowing`, `startShowing` and `stopShowing`; `post` takes an optional JSON body)
- Create: `packages/web/src/layout/ShowingControl.tsx`
- Create: `packages/web/src/layout/ShowingControl.stories.tsx`
- Modify: `packages/web/src/layout/Shell.tsx`
- Modify: `packages/web/src/runs/RunsPage.tsx` (the hidden line)
- Modify: `packages/web/src/runs/RunsPage.stories.tsx`
- Modify: `packages/web/src/lib/format.ts`
- Create: shadcn `dialog`, `checkbox` and `switch` in `packages/web/src/components/ui/`, added with its CLI
- Create: `packages/web/e2e/showing.spec.ts`
- Modify: `packages/web/playwright.config.ts` (`workers: 1`, with a comment saying why)
- Modify: `packages/web/src/test/runs.ts`

**Interfaces:**
- Consumes: `ShowingResponse` and `ShowingRequest` (Task 3), and `RunsResponse.hidden` (Task 3).
- Produces:
  - `useShowing()`: a `useQuery` on `['showing']` over `GET /api/showing`
  - `startShowing(projects: string[]): Promise<void>` and `stopShowing(): Promise<void>`, both through `post`
  - `ShowingControl()`
  - `hiddenRunsLabel(count: number): string` in `format.ts`, which gives `+ 2 runs in other projects, counted in totals and charts only`
  - `categoryLabel(category: string | null): string` in `format.ts`: `CATEGORY_LABELS`' label, and `unlabelled` for null (Tasks 7 and 8 use it)

`ShowingControl`:
- **Off:** a switch labelled "Showing mode". Turning it on opens a dialog listing `projects` with checkboxes and a "Start showing" button, disabled while nothing is picked.
- **On:** an orange bar reading "Showing: <names>", with a "Stop showing" button.
- After either POST, it calls `queryClient.invalidateQueries()`, so every page refetches under the new scope.

- [ ] **Step 1: Write the failing tests.**
  - **Stories with interaction tests:** Off, Picker (it opens, picks one project, starts, and asserts the POST body `{"projects":["<key>"]}` and the `X-Dashboard-Refresh` header), On, Loading and Error.
  - **RunsPage story `HiddenRuns`:** it shows `hiddenRunsLabel(2)`.
  - **`e2e/showing.spec.ts`** on dev:fixtures' data:
    - Turn the mode on for lantern-notes.
    - `/runs` has no tidepool-api row and shows the hidden line.
    - `/` has no tidepool-api item in the feed.
    - The page has no session ID text.
    - axe finds no violations with the dialog open and with the bar showing.
    - `afterEach` posts `{"projects":[]}` with the header.
- [ ] **Step 2: Run** `pnpm vitest run packages/web/src/layout packages/web/src/runs`. Expected: FAIL.
- [ ] **Step 3: Implement.** Add the three shadcn components with its CLI, then fix their imports to the app's relative-with-extension style only where the app's code imports them.
- [ ] **Step 4: Run** `pnpm vitest run packages/web` and `pnpm --filter @cwd/web exec playwright test --project=checks`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat: showing mode in the web app: the switch, the project picker and the bar`.

Conventions line for the report: the web app's POSTs (`refresh`, `markSeen`, `startShowing`, `stopShowing`) share `post`, which updates the `api.ts` line in `CLAUDE.md`.

### Task 7: The Findings page

**Wave:** D

**Files:**
- Create: `packages/web/src/findings/FindingsPage.tsx`
- Create: `packages/web/src/findings/FindingsGrid.tsx`
- Create: `packages/web/src/findings/FindingsList.tsx`
- Create: `packages/web/src/findings/SignalsPanel.tsx`
- Create: their `.stories.tsx` files
- Create: `packages/web/src/test/findings.ts`
- Modify: `packages/web/src/router.tsx` (`/findings`)
- Modify: `packages/web/src/layout/Menu.tsx` (Findings, after Runs)
- Modify: `packages/web/src/lib/format.ts` (`cellShade`)
- Create: `packages/shared/fixtures/labels.json`
- Modify: `packages/server/src/dev-fixtures.ts` (saves `labels.json` through `saveBatch` after the imports)
- Create: `packages/web/e2e/findings.spec.ts`
- Create: `packages/web/e2e/findings.screens.ts`, with its baseline from `pnpm test:screens`

**Interfaces:**
- Consumes: `FindingsResponse` (Task 5), `saveBatch` (Task 2) and `categoryLabel` (Task 6).
- Produces:
  - `FindingsPage()`
  - `FindingsGrid({ response, measure, area, selected, onSelect })`, where `measure` is one of `'raised' | 'actedOn' | 'invalid' | 'appDiffers'`
  - `FindingsList({ items })`
  - `SignalsPanel({ signals, labeller })`
  - `cellShade(value: number, max: number): string`, which gives one of five Tailwind classes on the dataviz blue ramp (`#cde2fb`, `#9ec5f4`, `#6da7ec`, `#2a78d6`, `#184f95`), white text on the two darkest, and a neutral grey for 0

The page:
- **Filters:** period selects of 4, 8 (the default) and 12 weeks, plus path and project, as on the Runs list. Projects come from `GET /api/runs?weeks=52`'s `projects`.
- **Switches:** measure and area.
- **The grid:** an HTML table, categories down and weeks across, each cell's number written in it. It is its own table view, so it isn't an ECharts chart. For "share acted on" and "share invalid", the cell shows a whole percent of `raised`, and "–" when `raised` is 0. "App differs" is disabled, with a tooltip: "Comes with the workflow's own labels".
- **A cell** is a button. Selecting it lists its findings below the grid: summary, run (a link to `/runs/$key`), step, outcome, relevance and reason, with a dashed "app" badge when `judge` is `app`.
- **The side panel** shows the four signals and the labeller line. That line reads "Labeller off: no API key" when it's off, otherwise "N labelled · M waiting · X tokens this week".

`labels.json` is an invented list of labels for report-later's findings, with `model: "fixture"`. dev:fixtures saves it, so the page and its screenshot show labels while the labeller stays off.

- [ ] **Step 1: Write the failing tests.**
  - **Stories:** Empty, Full, Loading and Error for the page, plus Empty and Full for each component. Full's interaction selects the `tests` cell and asserts the list shows its two findings.
  - **`e2e/findings.spec.ts`:**
    - Open Findings from the menu. The grid has a `correctness` row.
    - Click a non-zero cell. Its findings appear and one links to a run.
    - The labeller line reads "Labeller off".
    - axe finds no violations.
  - **`findings.screens.ts`:** a screenshot of `/findings` with the default filters.
- [ ] **Step 2: Run** `pnpm vitest run packages/web/src/findings`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run packages/web`, `pnpm --filter @cwd/web exec playwright test --project=checks` and `pnpm test:screens`. Expected: PASS, with the new baseline committed.
- [ ] **Step 5: Commit** with `feat: the Findings page: category by week, the selected cell's findings, the relevance signals`.

### Task 8: The run's findings table gains Category, Valid and App

**Wave:** D

**Files:**
- Modify: `packages/shared/src/api/runs.ts` (`FindingRow` gains fields)
- Modify: `packages/server/src/views/runs.ts` (`runView` takes the labels)
- Modify: `packages/server/src/routes.ts` (the run route passes `currentLabels`)
- Modify: `packages/server/test/runs.test.ts`
- Modify: `packages/web/src/runs/FindingsTable.tsx`
- Modify: `packages/web/src/runs/FindingsTable.stories.tsx`
- Modify: `packages/web/src/test/runs.ts`

**Interfaces:**
- Consumes: `currentLabels`, `labelInputs` and `StoredLabel` (Task 2), `Scope` (Task 3) and `categoryLabel` (Task 6).
- Changes:
  - `FindingRow` gains `category: string | null`, `relevance: Relevance | null`, `labelReason: string | null` (the label's reason; `reason` stays the session's) and `judge: 'app' | null`.
  - `runView(run, warnings, scope, labels: Map<string, StoredLabel>)`.

`FindingsTable` gains three columns:
- **Category:** `categoryLabel`, with a dashed outline badge when the judge is `app`.
- **Valid:** always `NONE` until CR10.
- **App:** the app's relevance, with `labelReason` in a tooltip, and `NONE` when unlabelled.

- [ ] **Step 1: Write the failing tests.**
  - In `runs.test.ts`, a labelled finding's row on `/api/runs/:key` carries its category, relevance, `labelReason` and `judge: 'app'`, and an unlabelled one carries nulls.
  - The `FindingsTable` stories `Full` and `Unlabelled` assert the three column headers and a dashed badge.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/runs.test.ts packages/web/src/runs/FindingsTable.stories.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run packages/server packages/web` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat: the run's findings table shows each finding's category and the app's relevance call`.

### Task 9: check:real's leak check and session matching

**Files:**
- Modify: `packages/server/src/check-real.ts`
- Modify: `packages/server/test/check-real.test.ts`
- Modify: `README.md` (the "Checking your real data" lines)

**Interfaces:**
- Consumes: `scopeOf`, `homeView`, `runsList`, `runView`, `findingsView` (Tasks 3 and 5), `projectRoot`, `sessionProject` (Task 1), `projectKey` and `runKey`.

`check:real` gains two checks, both on the export it already loads and with no database:
- **The showing check:**
  - Build `StoredUnit`s from the report's runs and sessions, with `firstSeenAt` and `now` being the current time, and `StoredWarning`s from their `warns`. `findingsView` gets an empty label map and the labeller off.
  - Pick the first project root in sorted order, and build every view's response with a scope that shows only it.
  - Search their JSON for every other root, every other root's folder name, and every session UUID from the sessions' files and the runs' window transcripts.
  - Print `showing: pass` or `showing: <n> leaks`, never a leaked value.
- **Session matching:** print `sessions: <m> of <n> matched a project`.

- [ ] **Step 1: Write the failing test.** `check-real.test.ts` runs check:real against `report-projects` with `cat` as the reporter, and expects these lines: `showing: pass`, `sessions: 2 of 3 matched a project`, and no line containing `/Users/`.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/check-real.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat: check:real checks showing mode for leaks on the real export and counts matched sessions`.
