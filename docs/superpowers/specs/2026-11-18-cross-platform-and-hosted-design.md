# edward off the Mac: Linux and Windows installs, a collector, and a hosted edward with accounts

Design only. Asked for while finishing the Work page run (2026-11-17), designed with the owner on 2026-11-18.

## Intent

edward runs only on the owner's Mac today, as a launchd agent serving 127.0.0.1. The owner wants three things, in
this order:

1. **Their own edward on their server**, reachable from anywhere (a phone later; not needed now), next to the public
   apps they already host there.
2. **Friends** who set up the workflow template (roland) can either install edward locally, on Mac, Linux or Windows,
   or use the owner's hosted edward with their own account, fed by a small collector on their laptop. For demos,
   friends can also see the owner's dashboard in showing mode.
3. **Someday, maybe:** the same thing as a subscription product (agent plus backend, as Datadog works). Not now: this
   design only keeps that door open.

Both products are work in progress; this is a playground and portfolio project. The hosted edward is a small, invite-
only service for the owner and a few friends, not a product.

## Goals

- Local installs on **macOS, Linux and Windows**, each with a background agent installed by one command.
- A **collector**: on the laptop where Claude Code runs, it runs the reporter and sends its export to a hosted edward.
- A **hosted mode** of the same app: GitHub sign-in, invite-only, one SQLite file per account, each account seeing only
  its own data, a viewer role for demos (showing mode, forced), each account's own Anthropic key for its labeller,
  account and admin settings pages, and account deletion.
- The data rules hold in every mode: the reporter is the only parser, no real data in the repo, showing mode masks
  what it hides, error text never quotes the data.

## Non-goals

- Phone access now (the hosted mode brings it, but nothing is designed for phones beyond the existing 375 px layout).
- Postgres, billing, sign-up without an invite, teams or shared accounts, an admin view of other accounts' data,
  encryption of the data files at rest.
- Running edward's server on Windows as the hosted server (the hosted server is Linux, in Docker).
- Changing the workflow repo: what edward needs from it goes there as change requests.

## Anti-goals (failure even if it works)

- **A leak between accounts**: any response, log line or error text in one account's request that holds another
  account's data.
- **A Windows path surviving showing mode** (`C:\Users\…` in a masked response): Windows support ships only with the
  path work below.
- **A secret where it doesn't belong**: an Anthropic key, collector token or session ID in a response, a log, an error
  text, the repo or a fixture; a stored token or session ID in clear.
- **Local mode getting worse**: a local install keeps working with no server, no account and no login, on 127.0.0.1.

## Constraints

- The reporter (`workflow-report.py`, from the workflow repo) must run where Claude Code runs, since it reads
  `~/.claude`. So a remote edward always needs something local to run it: the collector.
- Friends' data will sit on the owner's server, where the owner can read the files. The app gives no view into another
  account, but friends must be told this before they send data (the sign-in page says so).
- Auth, the request rules, account separation and secrets are risk areas: the plan for the hosted mode takes the Full
  path's risk-area reviews.

## What exists today (from the lookup, 2026-11-18)

- **Mac-only:** the launchd agent (`packages/server/src/agent.ts`: `plist()`, `LABEL`, `launchctl`,
  `~/Library/LaunchAgents`, `process.getuid`), the data folder default `~/Library/Application Support/...`
  (`config.ts:21`), the reporter default `/usr/bin/python3` (`config.ts:27`), README's requirements and install.
- **POSIX paths:** `WORKTREE`, `projectRoot`, `folderName` and `projectNames`' parent in
  `packages/shared/src/projects.ts`, the session project name in `facts.ts:108`, and `PATH_FOLDERS` in
  `packages/server/src/text.ts` (`trimPaths`, which `maskText` uses) all read `/` only. On Windows, a `C:\…` path is
  neither split nor masked.
- **POSIX test tooling:** `['sh', '-c', 'cat "$0"', file]` and `['cat', …]` reporter stand-ins in `dev-fixtures.ts` and
  the server tests; `test:screens` is a POSIX shell line around Docker.
- **Already portable:** the run-log watch (`triggers.ts`, one folder, not recursive), the 15-minute transcript check
  (`readdirSync` recursive), `process.loadEnvFile`, `spawn` of the reporter, every `join`-built path. CI runs on Ubuntu
  only.
- **No auth at all**: `createApp`'s one middleware checks `Host` (`localhost:<port>`, `127.0.0.1:<port>`) and, for any
  method but GET and HEAD, `X-Dashboard-Refresh: 1` and an allowed `Origin`; `serveApp` binds 127.0.0.1.
- **Database access lives in `packages/server/src/db/`** (31 query calls and 3 transactions in `import.ts`, `labels.ts`,
  `read.ts`); views are pure functions over loaded units.

## Approaches

### Where the dashboard runs for a remote user

- **(a) Private network (Tailscale or WireGuard) to a local edward.** No auth code; data never on a public machine.
  Needs an app on every device, and doesn't scale to friends. Declined by the owner.
- **(b) Public, with login, on the owner's server (picked by the owner).** Works from any browser, brings sharing with
  friends closer; costs an auth design and an internet-facing copy of the data.

### How accounts are kept apart (picked: one file per account)

- **(A) One SQLite file per account (picked by the owner).** A small accounts database plus `<account>.sqlite` with
  today's schema; a request opens its account's file, and everything below it is unchanged. Another account's rows
  are not in the file, so a missed filter can't leak them. Cross-account queries would need their own path (none
  needed).
- **(B) An owner column on every table.** The classic SaaS shape and closest to Postgres, but every query in
  `src/db/` and every future one must filter, one miss is a leak, and the migrations carry stored facts.
- **(C) One edward instance per person.** No separation code, but N deployments and N logins to run, and nothing that
  grows.

**Moving (A) to Postgres later** (asked by the owner): rewrite `schema.ts` to `pg-core` with a fresh migration
history; make the 31 query calls and 3 transactions async, which spreads to route blocks, the import queue and
`rebuildDerived`; one Postgres schema per account stands in for one file per account, so (B) is not forced; a one-off
copy of each file (derived rows rebuilt from `unit_versions`, stored facts copied); tests on PGlite or a container.
About one plan of 5 to 8 tasks, needed only when edward must run as more than one server process. To keep it cheap,
every query stays in `src/db/`, as today; no database abstraction is built ahead.

### How friends' findings get labelled (picked: their own key)

- **Their own key (picked by the owner):** each account sets its Anthropic key on the dashboard; the server stores it
  encrypted.
- **The owner's key, per account:** no friend's key stored, the owner pays. Declined.

## Decided with the owner

- Platforms: macOS, Linux and Windows for local installs and the collector; the hosted server is Linux.
- A hosted mode exists: public, behind a login, on the owner's server.
- Accounts from day one: each friend's collector feeds only their account; the owner can let viewers see their
  account in showing mode, for demos.
- One SQLite file per account.
- Each account labels with its own Anthropic key, set on its account settings.
- The owner grants GitHub users access (admin settings) and picks the projects viewers see, through showing mode.

## The design

Three modes of one app, chosen by `config.json`'s `mode`: `local` (the default, today's edward), `collector` and
`hosted`. Built in four phases, in this order (reordered by the owner during review, so the hosted edward comes before
Windows). Phase 1 ships on its own. Phases 2 and 3 ship together, since a collector has nothing to send to until the
hosted mode signs in and resolves tokens; the planning session may split them into two plans, the first holding the
collector, accounts, sign-in, request rules and tokens, the second viewers, the labeller, the admin settings and
deletion. Phase 4 starts only when its condition below holds.

### Phase 1: local installs on macOS and Linux

1. **Defaults per platform** in `loadConfig`: the data folder is `~/Library/Application Support/claude-workflow-dashboard`
   on macOS (unchanged) and `$XDG_DATA_HOME/claude-workflow-dashboard` (else `~/.local/share/...`) on Linux; the
   reporter's interpreter is `/usr/bin/python3` on macOS (unchanged) and `python3` on Linux, each with `-I`.
   `config.json` still overrides both.
2. **The agent per platform**, behind the same `pnpm agent:install` and `pnpm agent:uninstall`: launchd on macOS (as
   today) and a systemd user unit on Linux (`~/.config/systemd/user/<name>.service`, `Restart=always`, enabled with
   `systemctl --user enable --now`). Each file is made by a pure function beside `plist()`, unit-tested like it; no
   test runs `launchctl` or `systemctl` or writes outside a temp folder. The agent runs the mode `config.json` names
   (`local` runs the server, `collector` the collector).
3. **Test tooling without `sh`**: the reporter stand-ins become a small Node script under `packages/shared/test/`
   (prints a file, ignores extra arguments), used by `dev:fixtures` and the tests, so phase 4 finds them ready.
   `test:screens` stays a Linux container run.
4. **CI** adds a `macos-latest` job that runs typecheck and the vitest suites of `shared` and `server`; everything else
   stays on Ubuntu.
5. README: requirements and install per platform. Windows users run the workflow and edward under WSL, which is Linux.

### Phase 2: the collector

- `mode: "collector"` with `server` (the hosted edward's URL) in `config.json` and `EDWARD_TOKEN` (the account's
  collector token) in the data folder's `.env`, never in `config.json`, the repo or a log.
- It runs `startTriggers` as the local server does (run-log watch, 15-minute transcript check) and, on each trigger:
  asks the server for the account's cursor (`GET /api/collect/cursor`), runs the reporter with `--changed-since
  <cursor or 0>`, and sends the export as it is, gzipped, to `POST /api/collect`. The server imports it with
  `importReport`, unchanged, into that account's file; the cursor stays a stored fact on the server.
- A reporter failure is sent as `POST /api/collect/failure` with the same fixed text an import failure stores today
  (command, exit, stderr's last line), so the account's banner shows it. A send failure is logged locally, with the
  server's status only, and retried at the next trigger.
- **One machine per account, for now.** The reporter's cursor is `<state id>:<seq>`, and each machine's `~/.claude`
  has its own state id. The server records the state id of the account's stored cursor (from its first export, or from a copied local file)
  and refuses an export with
  another one (`/api/collect` answers 409 with a fixed message, which the collector logs), so a second machine never
  marks the first one's units missing. Deleting the account, or a "reset collector" action on the account settings
  that clears the stored cursor and state id, lets another machine take over. Several machines per account (a cursor
  and a missing rule per machine) is a later design.
- The collector reuses `runReporter`, `startTriggers` and `createQueue`; it holds no database.
- One machine can run both a local edward and a collector: they are two agents, each with its own name (the collector's
  agent runs `mode: "collector"` from its own config file), both reading the same reporter, whose cursor sequences
  allow two readers.
- Install, for friends as for the owner, is a clone of this repo, `pnpm install`, `pnpm build` (local mode only) and
  `pnpm agent:install`: Node runs the sources, as today, and nothing is published as a package.

### Phase 3: the hosted mode

**Deployment.** A Docker image (Node, the built web app, the server sources) run by the owner's existing setup behind
their reverse proxy, which terminates HTTPS. Inside the container the server binds `0.0.0.0`; the container's port is
published on the host's `127.0.0.1` only, so only the proxy reaches it. The data folder is a mounted volume.

**Server settings** in the container's `.env` (never the repo): `EDWARD_PUBLIC_HOST` (the public hostname),
`EDWARD_SECRET` (32 random bytes, for encrypting stored Anthropic keys), `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`.
`EDWARD_ADMIN` names the admin's GitHub login: the one account that can sign in with no invite, and the only one
that sees the admin settings.

**Storage.** `<dataDir>/accounts.sqlite` (Drizzle, its own schema and migrations) holds invites (GitHub login, added
time), accounts (GitHub numeric user id, login, created time, last collect), sessions (hashed ID, account, expiry), collector tokens (hashed, account, created, last
used), viewer grants (owner account, viewer account) and the encrypted Anthropic key with the labeller's settings per
account. Each account's dashboard data is `<dataDir>/accounts/<account id>.sqlite`, today's schema, migrated and
`rebuildDerived` when first opened in a process; open handles are kept in a map.

**Sign-in.** GitHub OAuth (authorization code, with a `state` checked on return). The identity is GitHub's numeric user
id, not the login, which can be renamed. A user whose login is invited (or is `EDWARD_ADMIN`) gets an account at first sign-in;
anyone else is refused with a fixed page. A session is a random 32-byte ID in a cookie (`HttpOnly`, `Secure`,
`SameSite=Lax`, 30 days), stored hashed. Sign-out deletes it. The sign-in page says, before the button, that data sent
here sits on the owner's server.

**Request rules**, still only in `createApp`'s one middleware: in hosted mode the `Host` must be
`EDWARD_PUBLIC_HOST`, the `Origin` of a non-GET must be `https://<EDWARD_PUBLIC_HOST>`, and the
`X-Dashboard-Refresh: 1` rule stays; then it resolves the caller: a session cookie (pages and `/api/*`) or, for
`/api/collect*` only, `Authorization: Bearer <collector token>` (no cookie, no `Origin`, no refresh header, since it
isn't a browser). No caller means 401 for the API and the sign-in page for pages. Local mode's rules are unchanged.
Still no `Access-Control-*` header anywhere.

**Account resolution.** After the middleware, every route gets its account's database instead of the one global
`deps.db`: routes and views keep reading "the database", so views stay pure and unchanged. One account's request
never opens another account's file, except a viewer's, below.

**Viewers (demos), through showing mode.** An account owner adds a GitHub login as a viewer of their account (an
invite is needed for that login to sign in). The projects a viewer sees are showing mode's projects: showing mode's
stored list is split from its switch, so the owner's list of shown projects stays when they turn showing mode off for
themselves (today an empty list turns it off and forgets the list). A viewer sees an account switcher: their own
account, and each account they view; viewing another account, every response is built with the scope of that
account's shown projects, whether its owner's showing mode is on or off, and with no shown projects a viewer sees
nothing. A viewer's POSTs (refresh, showing mode, labeller, tokens, settings) are refused. Showing mode stays enforced on the server, as
today: every route builds its scope, a hidden project's run is a 404, and each view's `leaks` check covers what a
viewer gets. As today, **every count includes every project** and only lists are filtered, so a viewer sees totals
(runs, costs, findings, spend) that include hidden projects, without their names (kept by the owner in review: totals
are the demo's interest and identify nothing). The account settings page says so beside the viewers list. The showing views,
`scopeOf`, `maskText` and `leaks` are reused as they are.

**Collector tokens.** An owner creates and revokes tokens on a settings page; a token (32 random bytes) is shown once
and stored as its SHA-256. A token resolves to its account and only to `/api/collect*`.

**Labeller per account.** An owner sets their Anthropic key, model and daily max on the settings page; the key is
stored encrypted with AES-256-GCM under `EDWARD_SECRET`, never returned (the page shows only whether a key is set),
never logged, never in an error text. `labelPending` runs per account with that account's client and settings; an
account with no key is never labelled. Local mode keeps its `.env` key.

**Bringing a local history into an account.** An account's file has today's schema, so a local `dashboard.sqlite`
becomes an account's data by being copied in: `pnpm account:import <github login> <file>`, run on the server (inside
the container), copies the file to that account's place. It refuses when the account doesn't exist yet (sign in
first) or already holds data, and when the file's migrations are newer than the server's; an older file is migrated
up and `rebuildDerived` as at every open. Its stored facts (labels and label batches, first-seen times, `missing_since`,
imports, the cursor, showing mode) come with it. Since the collector then runs on the same machine, reading the same
reporter, the stored cursor stays valid, and its state id becomes the account's one machine. The owner's own history
moves this way (decided by the owner); a friend's can too.

**After the move, the owner's Mac runs the collector only** (decided by the owner): the local server's agent is
uninstalled and the collector's installed, so findings aren't labelled twice on two bills and the stored facts have
one home. The copied `dashboard.sqlite` stays on the Mac as the backup of the moment it was copied. The hosted data
folder (accounts database and account files) is the only copy of what the hosted edward stores, so the deployment
includes it in the server's existing backups; the README's hosted section says so. Running both stays possible, not
the default.

**Refresh and status in hosted mode.** The server can't run the reporter, so the Refresh button is not shown in hosted
mode; imports happen when a collector sends. `/api/status`' importing state and last imports are the account's own
(the import queue's jobs carry their account), never another account's.

**Display names.** Hosted mode has no `aliases`: project names are folder names (as `projectNames` makes them with no
alias), so `scopeOf` takes an empty map there.

**Account deletion.** An owner can delete their account: their file, tokens, sessions, grants and key go; the next
sign-in (if still invited) starts empty.

**Account settings** (a page every account has, viewers of another account excluded): the Anthropic key (set or
replace, shown only as set or not), the labeller's model and daily max, collector tokens (create, shown once; revoke),
viewers of this account (add or remove a GitHub login), the shown projects (showing mode's existing picker), sign-out
and account deletion.

**Admin settings** (a page only `EDWARD_ADMIN`'s account sees): invites (add or remove a GitHub login) and the list of
accounts (login, created, last collect), with no way into an account's data. Removing an invite blocks that login's
sign-in, ends its sessions and refuses its collector tokens; its data stays until the account is deleted, by its owner
or by the admin from this page.

### Phase 4: native Windows (last, on a condition)

**Condition.** The workflow runs on native Windows only under WSL today (lookup of `~/.claude`, 2026-11-18): the
reporter imports `fcntl` unconditionally (`workflow-report.py:73`, used at `:3280` for its state lock), and the rest
of the workflow calls `/usr/bin/python3` in every hook and rule, `sh` and `$HOME` in hook commands, `signal.SIGHUP` and
`os.killpg` in `failing-test-check.py`, and symlinks for `--link`. Under WSL, Claude Code, the reporter and edward all
see Linux paths, so phase 1 covers a WSL user. Phase 4 starts when the workflow repo supports native Windows (a change
request goes there for the reporter at least, and to say how it writes Windows paths), or when the owner asks for it.

1. **Paths read both separators.** `projectRoot`, `WORKTREE`, `folderName`, `projectNames`' parent and `facts.ts`'
   session project name split on `/` and `\`, and know a drive root (`C:\`). `PATH_FOLDERS` in `text.ts` also matches
   a drive-letter path (`C:\…\`) and a `\`-separated one, so `trimPaths` and `maskText` cut them as they cut `/`
   paths. The leak check `leaks` and check:real's showing check get Windows-path fixtures: invented folder names under
   `C:\Users\…`, in runs and sessions alike. Keys (`runKey`, `sessionKey`, `projectKey`) hash the reporter's strings
   as they are, unchanged. No Windows data is sent to a hosted edward before this lands.
2. **Defaults:** `%LOCALAPPDATA%\claude-workflow-dashboard` and `py -3 -I`.
3. **The agent:** a Task Scheduler task (at logon, restarted on failure, through `schtasks` with a task XML), from a
   pure function, unit-tested; no test runs `schtasks`.
4. **CI** adds a `windows-latest` job running typecheck and the `shared` and `server` suites.

## Code conventions this changes

When each phase lands, `CLAUDE.md`'s conventions change to match (one line each), at least:

- `serveApp` listens on 127.0.0.1 in local mode, and on `0.0.0.0` only in hosted mode inside the container.
- The request rules gain hosted mode's `Host`, `Origin` and caller resolution, still in the one middleware.
- The Anthropic key lives in the data folder's `.env` in local mode, and encrypted per account in hosted mode.
- The launchd convention becomes one line per platform's agent file, each from a pure function.
- Paths are read with either separator wherever the app splits or masks them.

## Left to the builder

- The OAuth library or hand-written flow (Hono middleware is acceptable), the session table's cleanup, and the
  settings pages' components (on the kit, against `DESIGN.md`, with stories), once their mockups are approved.
- The Docker base image and compose file, and the request body limit for `/api/collect` (exports are a few MB).
- How the sign-in page, the account switcher, the account settings and the admin settings look: each is agreed as a
  mockup with invented data before its phase's plan, as every screen is.
- The order of tasks inside each phase, and how the collector's agent shares code with the server's.

## Calls made in this design (the owner may overrule)

- Invite-only by GitHub login, invites managed on the admin settings page; the admin is `EDWARD_ADMIN`.
- GitHub sign-in, no passwords.
- Viewers by GitHub login, no public share link (a link would show the owner's data to anyone holding it).
- A viewer sees the owner's shown projects (showing mode's list, kept when showing mode is off); none means nothing.
- Each account manages its own viewers; only the admin manages invites. Removing an invite keeps the account's data
  until it is deleted.
- One import queue across accounts (a few accounts don't need more).
- Windows' reporter command is `py -3 -I`; Linux's `python3 -I`.
- Windows comes last (phase 4), after the hosted edward (agreed by the owner in review); WSL users are covered by phase 1.
- macOS (phase 1) and Windows (phase 4) CI run only the shared and server tests.
- One machine per account (decided by the owner); a reset on the account settings hands the account to another.
- The owner's local history moves into their hosted account by copying their file (decided by the owner), through a
  server-side command, not an upload page.
- Phases 2 and 3 ship together (a collector needs the hosted mode's tokens).
- Local edward and a collector can run on one machine as two agents.
- Install is a clone and pnpm, no published package.
- No Refresh button in hosted mode; status is per account.
- No aliases in hosted mode.
