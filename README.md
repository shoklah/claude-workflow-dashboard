# claude-workflow-dashboard

A live, local dashboard for a Claude Code agentic workflow. It runs the workflow's reporter, `workflow-report.py --json`, on start, whenever the workflow's run log changes, every 15 minutes when a session transcript changed, and on the page's refresh button, keeps every import in a local SQLite database, and shows what the reporter says: runs by path, the findings each review step raised and acted on, warnings, and estimated spend, week by week.

![The home page on invented data](packages/web/e2e/home.screens.ts-snapshots/home-screens-linux.png)

The screenshot is one of the screenshot-test baselines, on invented data. The repo holds code and invented fixtures only; the real data is read at run time on your own machine and never leaves it. The server listens on `127.0.0.1` only.

## Requirements

- macOS (the dashboard runs as a launchd agent).
- Node 22.18 or later (see `.nvmrc`): Node runs the server's TypeScript directly.
- pnpm, the version in `package.json`'s `packageManager` (for example through `corepack enable`).
- The workflow's reporter installed at `~/.claude/scripts/workflow-report.py`, printing JSON version 1. Without it, each import fails with a banner naming the missing command.

## Install

```sh
pnpm install
pnpm build
pnpm agent:install
```

`pnpm build` builds the web app, which the server serves. `pnpm agent:install` writes a launchd agent to `~/Library/LaunchAgents/com.shoklah.claude-workflow-dashboard.plist` that starts the server at login, with the `node` that ran the command, and keeps it running. The dashboard is then at <http://localhost:4317>.

`pnpm agent:uninstall` stops the agent and deletes its file. To reinstall (after moving the repo or changing Node), uninstall first.

## The data folder

Everything the dashboard stores lives in `~/Library/Application Support/claude-workflow-dashboard/`, created with mode `0700`:

- `dashboard.sqlite`: the imports and what was read from them.
- `logs/`: the agent's `out.log` and `err.log`.
- `.env` (optional): the Anthropic API key and the labeller's settings, as `.env.example` lists them; with no key, the labeller stays off.
- `config.json` (optional): overrides any of the defaults below.

| Key | Default |
|---|---|
| `port` | `4317` |
| `reporterCommand` | `["/usr/bin/python3", "-I", "~/.claude/scripts/workflow-report.py", "--json"]`, with `~` expanded |
| `runLog` | `~/.claude/workflow-log.jsonl` (an import runs when it changes) |
| `projectsDir` | `~/.claude/projects` (the session transcripts, checked every 15 minutes) |
| `reporterTimeoutMs` | `120000` |
| `aliases` | `{}`: showing mode's display names, by project root path, e.g. `{"/Users/me/Work/app": "Notes app"}` |

## Checking your real data

```sh
pnpm --filter @cwd/server check:real
```

runs the reporter once and says whether the dashboard reads its output: the JSON version, the fields it can't read (`fields: none` when all is well), the run key counts, and the weeks whose sums differ from the reporter's totals. It prints no value from the data but those weeks' dates.

## Development

```sh
pnpm vitest run                                             # unit, API and Storybook tests
pnpm --filter @cwd/web exec playwright test --project=checks # accessibility and behaviour, on fixtures
pnpm test:screens                                           # screenshot comparisons, in the Playwright container (Docker)
pnpm --filter @cwd/server dev:fixtures                      # the server on invented data
```

CI runs all of these on the invented fixtures.
