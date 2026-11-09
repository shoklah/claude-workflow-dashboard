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
- **Evolving, current choice:** shadcn/ui for components, React Flow for the workflow diagram, ECharts for charts.

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
- The reporter's JSON schema lives in `packages/shared/src/report.ts`: every field is `.nullish()` (a `z.unknown()` one `.optional()`) unless the loader can't work without it, and a field the dashboard doesn't read is left out, so it is stripped.
- A fixture's `totals.weeks` agrees with its runs by the reporter's `week_rows` rules: per week start date, `runs` by path and `cost` as the sum of the priced cost of the runs with `models`, null when none has them.
- Stored derived values (a unit's `merged`, `readable`, `firstSeenAt` and its warnings) are written only by `applyVersion` in `packages/server/src/db/import.ts`, which both the import and `rebuildDerived` call, so a rebuild from `unitVersions` always gives the same rows; a new derived value goes there.
- `units.missing_since`, `imports` and `state` are stored facts, not derived: nothing in `unit_versions` can rebuild them, so a migration that drops or recreates their tables carries their values over.
- Migrations are generated with `drizzle-kit generate` from `packages/server/src/db/schema.ts` into `packages/server/drizzle/` and never hand-edited; SQL names are snake_case, times are `timestamp_ms` integers and JSON is `text` in `json` mode.
- Tests in any package read the invented fixtures, their JSON (`fixture`) or their file path (`fixturePath`), through `packages/shared/test/fixture.ts`, and every database test opens a fresh file in its own temp folder.
- A failure's error text (the reporter's, an import's) never quotes the reporter's stdout, which holds the data: it names the command, the exit and stderr's last line, or a fixed message.
- Background work (imports) runs through `createQueue` in `packages/server/src/queue.ts`, which logs a failing job instead of rejecting, so a background error never crashes the server.
- A test that waits on an `fs.watch` event repeats the change inside `vi.waitFor`, since macOS can drop a change made right after the watch starts.
