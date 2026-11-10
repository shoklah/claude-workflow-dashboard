# Live dashboard, slice 2a ("Findings and showing") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every stored finding gets a category and a relevance call from the app's labeller (Claude Haiku 5.5 over the Anthropic API, with the owner's key). A Findings page shows them by category and week. Showing mode filters every API response down to the projects the owner picks.

**Architecture:**
- **Projects:** a project gets an identity: its root path, with worktrees folded in, behind a hashed key.
- **Labeller:** a second background queue after each import labels each finding's trimmed text and stores the labels as facts beside the raw exports.
- **Showing mode:** server state, applied inside each view function by one scope helper. A shared leak check runs in the views' tests and in `check:real`.
- **Web:** the run page's findings table gains the label columns. The Findings page is a heatmap table that reuses that table for a cell's findings. The header gets the showing switch.

**Tech Stack:** As slice 1 (Node, TypeScript, Hono, Drizzle over `better-sqlite3`, zod, React, Vite, TanStack Query, Router and Table, Tailwind, shadcn/ui, Vitest, Storybook, Playwright, axe), plus `@anthropic-ai/sdk`.

**Spec:** `docs/superpowers/specs/2026-11-09-live-dashboard-design.md`: "Slice 2 design", the 2a sections, decisions 35–48 and the slice 2 entries under "Claude's calls". Mockups: `docs/design/2026-11-09-slice-2/findings.html` (layout B) and `basics-and-showing.html` (the showing mode part).

## Global Constraints

- **Read no real data:** not `~/.claude`, not the real data dir, not the reporter's output. Fixtures are invented. No test calls the Anthropic API: the label client is injected and stubbed.
- **The key and the labeller's settings** live only in `<dataDir>/.env`, which `main.ts` loads with `process.loadEnvFile` when it exists:
  - `ANTHROPIC_API_KEY`
  - `LABELLER_MODEL`, default `claude-haiku-5-5`
  - `LABELLER_DAILY_MAX`, default `500`

  With no key, the labeller is off. The key never reaches the repo, a fixture, a log or an error text.
- **The category list** is exactly the spec's, at version `1`:
  - plan: `scope`, `task split and order`, `spec gap`, `risk missed`, `test plan`
  - implementation: `correctness`, `error handling`, `data safety`, `security and privacy`, `reuse and duplication`, `conventions`, `simplicity`, `tests`, `naming and clarity`, `performance`, `docs`
  - cleanup uses the implementation list

  The display labels live in `packages/web/src/lib/format.ts`. Two add the spec's parentheses: "scope (missing or extra work)" and "simplicity (over-building)".
- **Relevance values** are exactly `valid`, `invalid` and `unclear`.
- **Areas:**
  - `plan_simplify` and `plan_review` are `plan`
  - `task_review`, `fix_check`, `final_review` and `final_fix_check` are `implementation`
  - `simplify` is `cleanup`
- **Labelling:**
  - Batches of `25`.
  - A label is keyed by run key, finding id and input hash.
  - Labels show for the current list version and input hash. Pending means no label from the configured model.
  - A finding with no id is never labelled.
- **Labels and label batches are stored facts.** A migration that drops or recreates their tables carries their rows over.
- **Showing mode** lives in `state`, under the name `showing`, as a JSON array of project keys.
  - With it on, no response holds an absolute path, a session ID, or a hidden project's name or branch. That covers every response, `/api/status` and `/api/showing` included.
  - A string that also belongs to a shown project is never treated as hidden. A shared folder name or a branch like `main` reveals nothing about the hidden project, so it is neither masked nor counted as a leak.
  - Hidden projects count only in sums.
  - Every session warning is left out, which fails closed. Session-to-project matching comes with 2b's Sessions page.
  - A picked project shows as its alias from `config.json`'s `aliases`, keyed by project root path, else its folder name. When two shown names are equal, each gets ` (<parent folder>)` appended.
- **A project is its root:** the record's `project` with any trailing `/` and any trailing `/.claude/worktrees/<name>` removed. Its key is `hash(root)`, the same 16-hex SHA-256 helper as the run keys.
- **Slice 1's rules hold:**
  - the request rules live only in `createApp`'s middleware
  - routes go in `registerRoutes`, one block per task
  - a page's response is built by a pure view in `packages/server/src/views/`
  - relative imports carry `.ts`
  - `@cwd/shared` imports no `node:` module
  - migrations come from `drizzle-kit generate` only
  - the web app reads the API only through `useStatus` and `useLiveQuery`, and POSTs through `post`
  - stories stub the API with `mockApi`
  - e2e tests pin the clock with `pinClock`
  - display formatting lives in `format.ts`
- **Failing-test check,** after each task: `/usr/bin/python3 -I ~/.claude/scripts/failing-test-check.py --base <task start SHA> --link node_modules --link packages/shared/node_modules --link packages/server/node_modules --link packages/web/node_modules --timeout 240 -- pnpm vitest run <the task's test files>`, with a `--test-file` for each of the task's test files.
- **Commit messages** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A hidden project's name inside a shown project's text,** for example a finding summary naming `tidepool-api`, or holding `/Users/example/Work/tidepool-api/src/x.ts`. It is masked as "another project". Only whole words are replaced, so a hidden name `api` leaves "rapid" alone. Pinned in Task 3.
2. **A bad reply from the model.** The reply is malformed, names a category outside the finding's area, or the API throws (429, overloaded). Nothing from that batch is stored, the queue logs it, and the next import retries. Pinned in Task 4.
3. **Showing mode across a restart,** and a `POST /api/showing` naming a key that isn't stored. The mode survives reopening the database. An unknown key answers 400 and leaves the mode unchanged. Pinned in Task 3.
4. **Project roots:** a path with a space or a trailing `/`, a worktree path, and two roots with the same folder name. Pinned in Task 1.
5. **Showing mode is server-wide state,** so a browser test that turns it on must not overlap another test. Playwright runs with `workers: 1`, and the showing spec stops the mode in `afterEach`. Pinned in Task 6.

---

### Task 1: Projects: root, key, names, and the Runs filter by key

**Files:**
- Create: `packages/shared/src/projects.ts`
- Create: `packages/shared/fixtures/report-projects.json`
- Create: `packages/shared/test/projects.test.ts`
- Modify: `packages/shared/src/index.ts` (one export line)
- Modify: `packages/shared/src/facts.ts` (`RunFacts` gains `projectKey`; `runFacts`' return type)
- Modify: `packages/shared/src/api/runs.ts` (`RunsQuery.project` is a key; `RunsResponse.projects`' shape)
- Modify: `packages/server/src/keys.ts` (exports `hash`, adds `projectKey`)
- Modify: `packages/server/src/views/runs.ts` (`storedFacts`, `runsList`'s project filter and list)
- Modify: `packages/server/src/views/home.ts` (uses `storedFacts`)
- Modify: `packages/server/test/runs.test.ts`
- Modify: `packages/server/test/keys.test.ts`
- Modify: `packages/web/src/runs/RunsPage.tsx` (the project select uses keys)
- Modify: `packages/web/src/runs/RunsPage.stories.tsx`
- Modify: `packages/web/src/test/runs.ts` (`projects`' shape)

**Interfaces:**
- Produces (shared, `projects.ts`):
  - `projectRoot(path: string): string`
  - `projectNames(roots: string[]): Map<string, string>`, mapping each root to its folder name, with ` (<parent>)` appended where names collide
- Produces (server):
  - `hash(text: string): string`, now exported from `keys.ts`
  - `projectKey(root: string): string`, which is `hash(root)`
  - `storedFacts(unit: StoredUnit<RunEntry>, names: Map<string, string>): RunFacts` in `views/runs.ts`. It adds `key`, `projectKey` and `project` (the name) to `runFacts`.
- Changes:
  - `RunFacts` gains `projectKey: string`.
  - `runFacts` returns `Omit<RunFacts, 'key' | 'projectKey'>`, with its body unchanged.
  - `RunsQuery.project` is a project key.
  - `RunsResponse.projects` becomes `{ key: string; name: string }[]`, sorted by name.

**The fixture** is an invented version 1 report whose `totals.weeks` agree with its runs (the fixture convention). It holds:
- a run in `/Users/example/Work/lantern-notes`
- a run in `/Users/example/Work/lantern-notes/.claude/worktrees/brave-otter`
- a run in `/Users/example/Archive/lantern-notes`
- a run in `/Users/example/Work/tidepool-api`, whose finding summary names `lantern-notes` and holds `/Users/example/Work/lantern-notes/src/sync.ts`
- findings in every area, plus one without an `id`
- two sessions
- a run warning and a session warning, each holding a `<uuid>.jsonl`

- [ ] **Step 1: Write the failing tests.**
  - In `projects.test.ts`:
    - `projectRoot('/Users/example/Work/lantern-notes/.claude/worktrees/brave-otter')` is `'/Users/example/Work/lantern-notes'`.
    - `projectRoot('/Users/example/My Work/app/')` is `'/Users/example/My Work/app'`.
    - `projectNames` of both lantern-notes roots gives `lantern-notes (Work)` and `lantern-notes (Archive)`.
  - In `runs.test.ts`, on `report-projects`:
    - The worktree run's row has the main lantern-notes root's `projectKey`.
    - `GET /api/runs?project=<that key>&weeks=52` returns only that project's two runs.
    - `projects` lists three entries with distinct names.
  - In `keys.test.ts`: `projectKey` is 16 hex characters.
- [ ] **Step 2: Run** `pnpm vitest run packages/shared/test/projects.test.ts packages/server/test/runs.test.ts packages/server/test/keys.test.ts`. Expected: FAIL, because `projectRoot` is not exported.
- [ ] **Step 3: Implement** the interfaces above.
  - `homeView` and `runsList` build `names` once from every stored run's root, and use `storedFacts` where they now spread `runFacts` and the key.
  - `RunsPage` sends the selected key and shows `name`.
- [ ] **Step 4: Run** the command from Step 2, then `pnpm vitest run packages/server packages/web/src/runs` and `pnpm typecheck`. Expected: PASS. Slice 1's tests still pass, changed only where `projects` changed shape.
- [ ] **Step 5: Commit** with `feat: a project is its root behind a key; worktrees fold in; the Runs filter uses the key`.

Conventions line for the report: a project is its root behind `projectKey`, and API responses carry the key and a display name, never the path.

### Task 2: Category list and stored labels

**Files:**
- Create: `packages/shared/src/categories.ts`
- Create: `packages/shared/test/categories.test.ts`
- Modify: `packages/shared/src/index.ts` (one export line)
- Create: `packages/server/src/text.ts` (`trimPaths` moves here from `routes.ts`)
- Modify: `packages/server/src/routes.ts` (imports `trimPaths`, and nothing else)
- Modify: `packages/server/src/db/schema.ts` (two tables)
- Create: the generated migration in `packages/server/drizzle/`
- Create: `packages/server/src/db/labels.ts`
- Create: `packages/server/test/labels.test.ts`

**Interfaces:**
- Consumes: `hash` (Task 1).
- Produces (shared, `categories.ts`):
  - `CATEGORY_LIST_VERSION = 1`
  - `AREAS = ['plan', 'implementation', 'cleanup'] as const` and `type Area`
  - `CATEGORIES: Record<Area, readonly string[]>`, where `cleanup` is the implementation list
  - `RELEVANCE = ['valid', 'invalid', 'unclear'] as const` and `type Relevance`
  - `areaOf(step: StepKind): Area`
- Produces (server):
  - `trimPaths(text: string): string` in `text.ts`
  - The tables:
    - `findingLabels`: `run_key`, `finding_id`, `input_hash`, `list_version`, `model`, `category`, `relevance`, `reason` and `labelled_at` (`timestamp_ms`), with its primary key on the first five
    - `labelBatches`: `id`, `at`, `input_tokens` and `output_tokens`
  - In `db/labels.ts`:
    - `type LabelInput = { runKey: string; findingId: string; area: Area; text: string; hash: string }`
    - `labelInputs(runs: StoredUnit<RunEntry>[]): LabelInput[]`
    - `type StoredLabel = { runKey: string; findingId: string; hash: string; model: string; category: string; relevance: Relevance; reason: string; labelledAt: Date }`
    - `currentLabels(db: Db, inputs: LabelInput[]): Map<string, StoredLabel>`, keyed `` `${runKey} ${findingId}` ``: the latest label at the current list version whose hash is the input's
    - `pendingInputs(db: Db, inputs: LabelInput[], model: string): LabelInput[]`
    - `saveBatch(db: Db, labels: StoredLabel[], usage: { at: Date; inputTokens: number; outputTokens: number }): void`, in one transaction
    - `labelledOn(db: Db, day: Date): number`, the labels whose `labelled_at` falls on that UTC day
    - `tokensSince(db: Db, from: Date): { input: number; output: number }`

**What `labelInputs` produces:**
- It skips findings with no `id` and steps with no kind.
- Each input's `text` is `JSON.stringify({ step, severity, kind, summary, outcome, reason, verdicts })`, with every string passed through `trimPaths`.
- Its `hash` is `hash(text)`.

- [ ] **Step 1: Write the failing tests.**
  - In `categories.test.ts`:
    - `areaOf('simplify')` is `'cleanup'`, and `areaOf('plan_review')` is `'plan'`.
    - `CATEGORIES.cleanup` equals `CATEGORIES.implementation`.
    - The lists are exactly the Global Constraints' strings.
  - In `labels.test.ts`, on a fresh database with `report-projects` imported:
    - `labelInputs` leaves out the finding with no id.
    - No input's `text` contains `/Users/`.
    - After `saveBatch` with one label, `currentLabels` holds it. `pendingInputs` no longer lists it for the same model, but lists it for another model.
    - Re-importing with that finding's summary changed: `currentLabels` drops it and `pendingInputs` lists it again.
    - `labelledOn` counts it on its day and not the next.
    - `tokensSince` sums the batch's tokens.
- [ ] **Step 2: Run** `pnpm vitest run packages/shared/test/categories.test.ts packages/server/test/labels.test.ts`. Expected: FAIL, because the modules don't exist.
- [ ] **Step 3: Implement.**
  - Move `trimPaths` with its regex and comment unchanged.
  - Add the tables, then run `pnpm --filter @cwd/server db:generate` and commit the generated SQL and meta unedited.
- [ ] **Step 4: Run** the command from Step 2, then `pnpm vitest run packages/server` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat: the category list and stored finding labels; trimPaths moves to text.ts`.

**Conventions lines for the report:**
- The error-text line names `trimPaths` in `packages/server/src/text.ts`.
- The labels line: labels are written only through `saveBatch` and read through `currentLabels`.

### Task 3: Showing mode on the server

**Wave:** B

**Files:**
- Create: `packages/shared/src/api/showing.ts`
- Modify: `packages/shared/src/index.ts` (one export line)
- Modify: `packages/shared/src/api/runs.ts` (`RunsResponse.hidden`)
- Create: `packages/server/src/views/scope.ts`
- Modify: `packages/server/src/db/read.ts` (`getShowing`, `setShowing`)
- Modify: `packages/server/src/config.ts` (`aliases`)
- Modify: `packages/server/src/app.ts` (`AppDeps.aliases`)
- Modify: `packages/server/src/main.ts` (the `serveApp` call only)
- Modify: `packages/server/src/dev-fixtures.ts` (the `serveApp` call only)
- Modify: `packages/server/src/routes.ts` (a showing block; `scope` passed to the home, runs and run views)
- Modify: `packages/server/src/views/home.ts`
- Modify: `packages/server/src/views/runs.ts`
- Modify: every test that builds `AppDeps` (adds `aliases: {}`)
- Create: `packages/server/test/showing.test.ts`
- Modify: `packages/web/src/test/runs.ts` (`hidden: 0`)
- Modify: `README.md` (one row, `aliases`, in the config table)

**Interfaces:**
- Consumes: `projectRoot`, `projectNames`, `projectKey` and `storedFacts` (Task 1), and `trimPaths` (Task 2).
- Produces (shared):
  - `type ShowingResponse = { on: boolean; projects: { key: string; name: string; picked: boolean }[] }`
  - `type ShowingRequest = { projects: string[] }`
  - `RunsResponse` gains `hidden: number`
- Produces (server):
  - `getShowing(db: Db): string[] | null` and `setShowing(db: Db, projects: string[] | null): void`, where null deletes the state row
  - `Config.aliases: Record<string, string>`, default `{}`
  - In `views/scope.ts`:
    - `type Scope = { shown: Set<string>; names: Map<string, string>; hidden: string[] }`. `shown` holds the shown project keys, and `names` maps each to its alias or name. `hidden` holds the hidden projects' folder names, minus any a shown project also has.
    - `scopeOf(showing: string[] | null, roots: string[], aliases: Record<string, string>): Scope | null`
    - `maskText(scope: Scope, text: string): string`. It runs `trimPaths`, turns each whole-word occurrence of a hidden name into `another project`, and turns each `<uuid>.jsonl` into `a session`.
    - `leaks(json: unknown, forbidden: string[]): string[]`: the forbidden strings found in `JSON.stringify(json)`. It is in `src` so that `check:real` can use it.
    - `forbiddenStrings(roots: string[], branches: Map<string, string[]>, shownRoots: string[], sessionIds: string[]): string[]`. It lists the hidden roots, their folder names and their branches, minus any string a shown root or a shown run also has, plus the session IDs. Branches are keyed by root. Task 3's tests and check:real both use it.
- Changes:
  - `homeView`'s input gains `scope: Scope | null`.
  - `runsList` gains a final `scope: Scope | null`.
  - `runView` gains `scope: Scope | null` and returns `RunResponse | null`, null for a hidden run. The route answers that with 404.

**With a scope:**
- Rows, feed items, run warnings and `RunsResponse.projects` keep only shown projects.
- Every session warning is left out.
- `project` is the scope's name.
- Every text goes through `maskText` before anything else. A warning is built from its masked raw text, with no `splitSessionId` and `sessionId` null, so no `{session}` placeholder is left behind.
- `/api/status`'s `error` goes through `maskText`.
- `hidden` counts the period's runs that are left out.
- Sums, tiles, charts and the diagram still count every run.

**The showing block:**
- `GET /api/showing` answers `ShowingResponse`. While showing is off, it lists every stored project's key and name. While it is on, it lists only the picked projects.
- `POST /api/showing` takes a `ShowingRequest`. An empty list stops showing. A key that isn't stored answers 400 and leaves the state unchanged.

- [ ] **Step 1: Write the failing tests** in `showing.test.ts`, on `report-projects`, with showing set to the lantern-notes (Work) key and that root aliased `Notes app`:
  - `leaks` finds nothing in the responses below, searching for `forbiddenStrings` of the fixture plus `/Users/example`:
    - `/api/home`, `/api/runs?weeks=52` and each shown run's `/api/runs/:key`
    - `/api/showing`
    - `/api/status`, after a `recordImportFailure` whose text holds a path and a `<uuid>.jsonl`
  - `/api/runs` has `hidden` equal to 2, and every row's `project` is `Notes app`.
  - The tidepool run's page answers 404.
  - `maskText` on the tidepool finding's summary has `another project` and no `/Users/`.
  - `maskText` with a scope whose `hidden` is `['api']` turns `"rapid api"` into `"rapid another project"`.
  - With the Archive lantern-notes root shown and the Work one hidden, `scopeOf`'s `hidden` doesn't hold `lantern-notes`.
  - The home tiles' run counts equal those with showing off.
  - `POST /api/showing` with an unknown key answers 400, and `getShowing` is unchanged.
  - After closing and reopening the database file, `getShowing` still gives the key.
  - An empty list turns the mode off.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/showing.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces. The routes build the scope from `getShowing`, the stored runs' roots and `deps.aliases`.
- [ ] **Step 4: Run** `pnpm vitest run packages/server packages/web/src/runs` and `pnpm typecheck`. Expected: PASS, with slice 1's tests passing `scope: null`.
- [ ] **Step 5: Commit** with `feat: showing mode on the server: state, the scope helper in every view, leak checks`.

Conventions line for the report: the existing showing line in `CLAUDE.md` gains the helper names `scopeOf` and `maskText` in `views/scope.ts`, and the leak check `leaks` beside them.

### Task 4: The labeller

**Wave:** B

**Files:**
- Create: `packages/server/src/labeller.ts`
- Create: `packages/server/test/labeller.test.ts`
- Modify: `packages/server/src/main.ts` (the env loading and the label queue; not the `serveApp` call)
- Modify: `packages/server/src/queue.ts` (`createQueue(job, name = 'import')`, whose log line reads `${name} job failed:`)
- Modify: `packages/server/test/queue.test.ts`
- Modify: `packages/server/package.json` (`@anthropic-ai/sdk`, pinned)
- Modify: `pnpm-lock.yaml`
- Create: `.env.example`
- Modify: `README.md` (one line for `.env` in the data folder list)

**Interfaces:**
- Consumes: `LabelInput`, `labelInputs`, `pendingInputs`, `saveBatch`, `labelledOn`, `CATEGORIES`, `RELEVANCE` and `Area` (Task 2).
- Produces, in `labeller.ts`:
  - `type LabelClient = (batch: { id: string; area: Area; text: string }[]) => Promise<{ results: { id: string; category: string; relevance: Relevance; reason: string }[]; inputTokens: number; outputTokens: number }>`
  - `labellerSettings(env: Record<string, string | undefined>): { model: string; dailyMax: number } | null`, null when `ANTHROPIC_API_KEY` is empty or missing
  - `anthropicLabelClient(model: string): LabelClient`
  - `labelPending(db: Db, client: LabelClient, settings: { model: string; dailyMax: number }, now: Date): Promise<void>`

**`labelPending`:**
- Takes `pendingInputs` for the model, limited to `dailyMax - labelledOn(now)`.
- Sends them in batches of 25, with ids `f1` to `f25`.
- Keeps only results whose category is in `CATEGORIES[input.area]`.
- Saves each batch through `saveBatch`.
- On a throw, stops and rethrows, so the queue logs it.

**`anthropicLabelClient`:**
- Uses `new Anthropic()`, which reads `ANTHROPIC_API_KEY`.
- Calls `client.messages.parse` with `max_tokens: 4096` and `output_config: { format: zodOutputFormat(LabelsSchema) }` (from `@anthropic-ai/sdk/helpers/zod`), then reads `parsed_output` and takes the tokens from `response.usage`.
- `LabelsSchema` is `z.object({ labels: z.array(z.object({ id, category: z.enum(every category), relevance: z.enum(RELEVANCE), reason: z.string() })) })`.
- If the helper rejects zod 4, it falls back to `messages.create` with `output_config: { format: { type: 'json_schema', schema } }`, a hand-written schema, and parses the text block with `LabelsSchema`. The report says which was used.
- Its prompt says: a finding comes from a code review step in an agentic workflow; pick one category from the area's list; judge whether it was a real problem worth raising (valid), not one (invalid), or can't tell (unclear); give a reason in one sentence.
- Check the SDK call's shape against the `claude-api` skill before writing it.

**`main.ts`:**
- Loads `<dataDir>/.env` with `process.loadEnvFile` when the file exists.
- When there are settings, adds a second `createQueue` running `labelPending` with the real client.
- The import queue's job becomes `async () => { await importOnce(db, config, now); labels?.request(); }`.

**`.env.example`** lists the three variables with no values, and a comment naming the data folder.

- [ ] **Step 1: Write the failing tests** in `labeller.test.ts`. A stub `LabelClient` records each batch's size and answers valid labels. The report imported is `report-projects` with one run's findings repeated under new ids, `F100` onward, until there are at least 60 with ids; the change is made in the test to the parsed fixture.
  - With 60 pending findings and `dailyMax` 500, the batches are 25, 25 and 10, and 60 labels are stored.
  - With `dailyMax` 30, 30 are stored, and a second run the same day stores none.
  - A result whose category is outside its area (`correctness` for a plan finding) is not stored.
  - A client that throws stores nothing from that batch, and `labelPending` rejects.
  - `labellerSettings({})` is null.
  - `labellerSettings({ ANTHROPIC_API_KEY: 'k' })` is `{ model: 'claude-haiku-5-5', dailyMax: 500 }`.
  - `LABELLER_DAILY_MAX: '40'` gives 40.
  - In `queue.test.ts`: a queue named `label` logs `label job failed:` when its job throws.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/labeller.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces and the wiring, with the SDK at its latest stable version, pinned.
- [ ] **Step 4: Run** `pnpm vitest run packages/server` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat: the labeller labels each finding's text with a category and a relevance call, in batches, under a daily cap`.

Stack line for the report, for `CLAUDE.md`'s `## Stack`: `@anthropic-ai/sdk` for the labeller's calls, through the official SDK.

### Task 5: The run's findings table gains Category, Valid and App

**Wave:** C

**Files:**
- Modify: `packages/shared/src/api/runs.ts` (`FindingRow`)
- Modify: `packages/server/src/views/runs.ts` (`runView` takes the labels)
- Modify: `packages/server/src/routes.ts` (the run route passes `currentLabels`)
- Modify: `packages/server/test/runs.test.ts`
- Modify: `packages/web/src/runs/FindingsTable.tsx`
- Modify: `packages/web/src/runs/FindingsTable.stories.tsx`
- Modify: `packages/web/src/lib/format.ts` (`categoryLabel`)
- Modify: `packages/web/src/test/runs.ts` (`runFull`'s finding rows)

**Interfaces:**
- Consumes: `currentLabels`, `labelInputs` and `StoredLabel` (Task 2), and `Scope` (Task 3).
- Changes:
  - `FindingRow` gains `category: string | null`, `relevance: Relevance | null` and `labelReason: string | null`. `labelReason` is the label's reason; `reason` stays the session's.
  - `runView(run, warnings, scope, labels: Map<string, StoredLabel>)`.
  - `FindingsTable({ findings, run }: { findings: (FindingRow & { runKey?: string; run?: string })[]; run?: boolean })`. With `run`, it adds a first column linking each row to `/runs/$key`; the Findings page uses it (Task 8).
- Produces: `categoryLabel(category: string | null): string` in `format.ts`, giving the display label, and `unlabelled` for null.

**`FindingsTable`'s new columns:**
- **Category:** `categoryLabel`, with a dashed outline badge marking the app's label whenever a category is set.
- **Valid:** `NONE` until CR10.
- **App:** the app's relevance, with `labelReason` in a tooltip, and `NONE` when the finding is unlabelled.

- [ ] **Step 1: Write the failing tests.**
  - In `runs.test.ts`: a labelled finding's row on `/api/runs/:key` carries its category, relevance and `labelReason`, and an unlabelled one carries nulls.
  - The `FindingsTable` stories `Full`, `Unlabelled` and `WithRun` assert:
    - the three new column headers
    - the dashed badge
    - in `WithRun`, the run link
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/runs.test.ts packages/web/src/runs/FindingsTable.stories.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run packages/server packages/web` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat: the run's findings table shows each finding's category and the app's relevance call`.

### Task 6: Showing mode in the web app

**Wave:** C

**Files:**
- Modify: `packages/web/src/api.ts` (`showProjects`; `post` takes an optional JSON body)
- Create: `packages/web/src/layout/ShowingControl.tsx`
- Create: `packages/web/src/layout/ShowingControl.stories.tsx`
- Modify: `packages/web/src/layout/Shell.tsx`
- Modify: `packages/web/src/layout/Shell.stories.tsx` (stubs `/api/showing`)
- Modify: `packages/web/src/runs/RunsPage.tsx` (the hidden line; `PERIODS` and `SELECT` exported)
- Modify: `packages/web/src/runs/RunsPage.stories.tsx`
- Modify: `packages/web/src/lib/format.ts` (`hiddenLabel`)
- Create: shadcn `dialog` and `switch` in `packages/web/src/components/ui/`, added with its CLI
- Create: `packages/web/e2e/showing.spec.ts`
- Modify: `packages/web/playwright.config.ts` (`workers: 1`, with a comment on why)
- Modify: `packages/web/src/test/runs.ts` (a `runsHidden` response)

**Interfaces:**
- Consumes: `ShowingResponse`, `ShowingRequest` and `RunsResponse.hidden` (Task 3).
- Produces:
  - `showProjects(projects: string[]): Promise<void>`, through `post`, where `[]` stops showing
  - `ShowingControl()`, which reads `useLiveQuery<ShowingResponse>('/api/showing')`
  - `hiddenLabel(count: number, noun: string): string`, built with `plural`. `hiddenLabel(2, 'run')` gives `+ 2 runs in other projects, counted in totals and charts only`.

**`ShowingControl`:**
- **Off:** a switch labelled "Showing mode". Turning it on opens a dialog listing the projects with native checkboxes, and a "Start showing" button that stays disabled while nothing is picked.
- **On:** an orange bar, "Showing: <names>", with a "Stop showing" button.
- After either POST, it calls `queryClient.invalidateQueries()`.

- [ ] **Step 1: Write the failing tests.**
  - Stories with interaction tests:
    - Off.
    - Picker: it opens, picks one project, starts, and asserts the POST body `{"projects":["<key>"]}` and the `X-Dashboard-Refresh` header.
    - On.
    - Loading.
    - Error.
  - The RunsPage story `HiddenRuns` shows `hiddenLabel(2, 'run')`.
  - The Shell stories stub `/api/showing` as off, and still render with no error state.
  - `e2e/showing.spec.ts`, on dev:fixtures' data:
    - Turn the mode on for lantern-notes.
    - `/runs` has no tidepool-api row and shows the hidden line.
    - `/` has no tidepool-api item in the feed.
    - No page text holds a session ID.
    - axe finds no violations with the dialog open, nor with the bar on.
    - `afterEach` posts `{"projects":[]}` with the header.
- [ ] **Step 2: Run** `pnpm vitest run packages/web/src/layout packages/web/src/runs`. Expected: FAIL.
- [ ] **Step 3: Implement.** Add `dialog` and `switch` with the shadcn CLI. The app's code imports them relatively, with their extension.
- [ ] **Step 4: Run** `pnpm vitest run packages/web` and `pnpm --filter @cwd/web exec playwright test --project=checks`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat: showing mode in the web app: the switch, the project picker and the bar`.

Conventions line for the report: the `api.ts` line in `CLAUDE.md` adds `showProjects` to the POSTs that share `post`.

### Task 7: The Findings API

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
- Consumes:
  - Task 2: `labelInputs`, `currentLabels`, `pendingInputs`, `tokensSince`, `CATEGORIES`, `areaOf`
  - Task 3: `Scope`, `maskText`, `leaks`
  - Task 1: `storedFacts`
  - Task 5: `FindingRow`'s label fields
- Produces (shared):
  - `type FindingCell = { raised: number; actedOn: number; invalid: number }`
  - `type FindingsRow = { area: Area; category: string | null; cells: FindingCell[] }`, where a null category is the area's "unlabelled" row
  - `type FindingItem = FindingRow & { runKey: string; run: string; week: string; area: Area }`
  - `type FindingsQuery = { weeks: number; path?: Path; project?: string }`
  - `type FindingsResponse = { weeks: string[]; rows: FindingsRow[]; findings: FindingItem[]; hidden: number; signals: { laterFixes: number; finalAfterClean: number; notProportionate: number; declinedOrRuled: number }; labeller: { on: boolean; labelled: number; waiting: number; tokensThisWeek: { input: number; output: number } } }`
- Produces (server): `findingsView(input: { runs: StoredUnit<RunEntry>[]; labels: Map<string, StoredLabel>; query: FindingsQuery; now: Date; scope: Scope | null; labeller: FindingsResponse['labeller'] }): FindingsResponse`

**The view** (all sums over stored runs):
- **Weeks:** `query.weeks` weeks ending this week, oldest first. A finding's week is `weekOf` its run's finish time.
- **Rows:** each area in `AREAS` order, then each of `CATEGORIES[area]` in list order, plus the area's unlabelled row when any of its findings has no label.
- **Cell counts:**
  - `raised` counts every finding.
  - `actedOn` follows `splitFindings`' definition.
  - `invalid` counts the labels judged invalid.
- **Signals:**
  - `laterFixes`: the period's runs' `later_fixes` length.
  - `finalAfterClean`: final-review findings in runs whose `task_review` steps (at least one) all have zero findings.
  - `notProportionate`: the sum of `fix_check` and `final_fix_check` `counts.not_proportionate`.
  - `declinedOrRuled`: findings declined or ruled.
- **With a scope:** cells count every project. `findings` lists only shown projects' findings, with `maskText` on `summary`, `reason` and `labelReason`. `hidden` counts the findings left out.

**The route:** `GET /api/findings` parses `weeks` (default 4, as the Runs list), `path` and `project` (a key).
- `labeller.on` is `deps.labeller !== null`.
- `labelled` is the size of `currentLabels`.
- `waiting` is the number of `pendingInputs` for the model, or 0 when off.
- `tokensThisWeek` is `tokensSince(weekStart(now))`.

- [ ] **Step 1: Write the failing tests** in `findings.test.ts`, on `report-projects` with labels saved through `saveBatch`:
  - `rows` starts with the plan area's five categories in list order.
  - A labelled `tests` finding counts in its week's `tests` cell.
  - An unlabelled finding, and the finding with no id, land in their area's unlabelled row.
  - `signals.finalAfterClean` equals the fixture's count.
  - With a scope on lantern-notes (Work):
    - `findings` holds no tidepool item, and `hidden` counts them.
    - The cells still include them.
    - `leaks` against `/Users/example` and `tidepool-api` is empty.
  - `labeller` is `{ on: false, labelled: <n>, waiting: 0, ... }` when `deps.labeller` is null.
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/findings.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run packages/server` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat: GET /api/findings: findings by category and week, relevance signals, the labeller's state`.

### Task 8: The Findings page

**Files:**
- Create: `packages/web/src/findings/FindingsPage.tsx`
- Create: `packages/web/src/findings/FindingsGrid.tsx`
- Create: `packages/web/src/findings/SignalsPanel.tsx`
- Create: their `.stories.tsx` files
- Create: `packages/web/src/test/findings.ts`
- Modify: `packages/web/src/router.tsx` (`/findings`)
- Modify: `packages/web/src/layout/Menu.tsx` (Findings, after Runs)
- Modify: `packages/web/src/layout/Menu.stories.tsx` (its entries include Findings)
- Modify: `packages/web/e2e/shell.screens.ts-snapshots/menu-screens-linux.png` (the menu baseline, re-rendered by `pnpm test:screens`)
- Modify: `packages/web/src/lib/format.ts` (`cellShade`)
- Create: `packages/shared/fixtures/labels.json`
- Modify: `packages/server/src/dev-fixtures.ts` (saves `labels.json` through `saveBatch` after the imports)
- Create: `packages/web/e2e/findings.spec.ts`
- Create: `packages/web/e2e/findings.screens.ts`, with its baseline from `pnpm test:screens`

**Interfaces:**
- Consumes:
  - `FindingsResponse` (Task 7)
  - `FindingsTable` with `run` and `categoryLabel` (Task 5)
  - `PERIODS` and `SELECT` (Task 6)
  - `saveBatch` (Task 2)
- Produces:
  - `FindingsPage()`
  - `FindingsGrid({ response, measure, area, selected, onSelect })`, where `measure` is `'raised' | 'actedOn' | 'invalid'`
  - `SignalsPanel({ signals, labeller })`
  - `cellShade(value: number, max: number): string`: one of five classes on the dataviz blue ramp (`#cde2fb`, `#9ec5f4`, `#6da7ec`, `#2a78d6`, `#184f95`), with white text on the two darkest and a neutral grey for 0

**The page:**
- **Filters:** the Runs list's `PERIODS` (default 4 weeks) in its `SELECT` style, path, and project. The project options come from `GET /api/runs?weeks=52`'s `projects`.
- **Switches:** a measure switch (raised, share acted on, share judged invalid) and an area switch.
- **The grid:** an HTML table, categories down and weeks across, with each cell's number written in it, so it is its own table view.
  - The two share measures show a whole percent of `raised`, and "–" when `raised` is 0.
  - "App differs" shows as a disabled switch option with a tooltip: "Comes with the workflow's own labels".
  - A line above the grid says every label is the app's until the workflow labels findings.
- **A cell** is a button. Selecting it lists its findings below with `FindingsTable` and `run`. Under that list, `hiddenLabel(response.hidden, 'finding')` shows while `hidden` is above 0.
- **The side panel** shows the four signals and the labeller line. The line reads "Labeller off: no API key" when off, and otherwise "N labelled · M waiting · X tokens this week".

**`labels.json`** is an invented list of labels for the findings of the lantern-notes Full and plan runs (report-full's runs, which report-later re-exports), with `model: "fixture"`.
- Each entry names its run by `date` and `branch`, plus `findingId`, `category`, `relevance` and `reason`. It holds no key or hash.
- dev:fixtures resolves each entry's `runKey` and `hash` through `labelInputs(listUnits(db, 'run'))`, then calls `saveBatch`. An entry that matches no input stops dev:fixtures with an error, so a stale fixture can't silently leave the page unlabelled.
- The page and its screenshot then show labels while the labeller stays off.

Load the `dataviz` skill before writing `cellShade` and the grid.

- [ ] **Step 1: Write the failing tests.**
  - Stories:
    - The page: Empty, Full, Loading and Error.
    - The grid and the panel: Empty and Full.
    - Full's interaction selects the `tests` cell and asserts the table below lists its findings.
    - The story `HiddenFindings` shows `hiddenLabel(3, 'finding')`.
  - `e2e/findings.spec.ts`:
    - Open Findings from the menu, and see a `correctness` row in the grid.
    - Click a non-zero cell: its findings appear, with a link to a run.
    - The labeller line reads "Labeller off".
    - axe finds no violations.
  - `findings.screens.ts`: `/findings` with the default filters.
- [ ] **Step 2: Run** `pnpm vitest run packages/web/src/findings`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run packages/web`, `pnpm --filter @cwd/web exec playwright test --project=checks` and `pnpm test:screens`. Expected: PASS, with the new baseline committed.
- [ ] **Step 5: Commit** with `feat: the Findings page: category by week, the selected cell's findings, the relevance signals`.

### Task 9: check:real's showing-mode leak check

**Files:**
- Modify: `packages/server/src/check-real.ts`
- Modify: `packages/server/test/check-real.test.ts`
- Modify: `README.md` (the "Checking your real data" lines)

**Interfaces:**
- Consumes:
  - `openDb`, `importReport`, `setShowing`, `createApp`
  - `leaks` and `forbiddenStrings` (Task 3)
  - `projectRoot` and `projectKey` (Task 1)

**What the check does:** after its current checks, on the export it already loaded, `check:real`:
1. Opens a fresh database in a temp folder, never the real one, and imports the export with `importReport`.
2. Picks the first project root in sorted order and calls `setShowing` with its key.
3. Sends requests with `createApp({...}).request(path, { headers: { Host } })` to `/api/status`, `/api/showing`, `/api/home`, `/api/runs?weeks=52`, each shown run's `/api/runs/:key`, and `/api/findings?weeks=52`.
4. Runs `leaks` on each response against `forbiddenStrings`. Its inputs are the export's roots, each root's run branches, the shown root, and every session UUID in the export's session files and run window transcripts.
5. Prints `showing: pass` or `showing: <n> leaks`, never a leaked value, and removes the temp folder.

- [ ] **Step 1: Write the failing test.** `check-real.test.ts` runs check:real against `report-projects` with `cat` as the reporter, and expects:
  - a `showing: pass` line
  - no line containing `/Users/`
- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/check-real.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm vitest run` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat: check:real checks showing mode for leaks on the real export`.
