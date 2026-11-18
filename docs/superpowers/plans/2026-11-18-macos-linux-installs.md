# macOS and Linux local installs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** edward installs and runs on Linux as it does on macOS: platform defaults for the data folder and the reporter's Python, and a systemd user unit beside the launchd agent, behind the same `pnpm agent:install`.

**Architecture:** `loadConfig`'s defaults come from one pure function of the platform, the environment and the home folder. `agent.ts` gains a pure `systemdUnit()` beside `plist()` and a pure `agentSpec()` that says, per platform, which file to write with which contents and which commands start and stop it; the CLI only writes that file and runs those commands. A macOS CI job runs the server and shared suites.

**Tech Stack:** Node >= 22.18 running TypeScript sources, Vitest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-18-cross-platform-and-hosted-design.md`, "Phase 1: local installs on macOS and Linux".

## Global Constraints

- macOS behaviour is unchanged: data folder `~/Library/Application Support/claude-workflow-dashboard`, reporter `/usr/bin/python3 -I`, launchd label `com.shoklah.claude-workflow-dashboard`, plist in `~/Library/LaunchAgents`.
- Linux: data folder `$XDG_DATA_HOME/claude-workflow-dashboard`, else `~/.local/share/claude-workflow-dashboard`; reporter `python3 -I`; a systemd user unit at `~/.config/systemd/user/claude-workflow-dashboard.service`, `Restart=always`, enabled and (re)started by `systemctl --user`. The service runs in the systemd user manager's environment, not the install shell's: a `XDG_DATA_HOME` the install shell has is written into the unit (`Environment=`), so the service and the install agree on the data folder.
- `config.json` still overrides every default; the data folder is still created with mode `0700`.
- The data folder and the agent's names keep the project's first name, `claude-workflow-dashboard`; Task 1 records the unit name `UNIT` in CLAUDE.md's first code convention beside the launchd label.
- No test runs `launchctl` or `systemctl`, or writes outside a temp folder; Windows is out of scope (phase 4).
- Erasable-only TypeScript, relative imports with `.ts`, `import type` for types.

## Review Focus

1. **A path with spaces, `%`, `$`, `"` or `\` in the unit file** (a repo cloned under `~/My Projects`): systemd reads `%` as a specifier, expands `$` in `ExecStart` and splits it on spaces, so the unit must quote and escape; tested in Task 2.
2. **`XDG_DATA_HOME` set in the shell but not in the systemd user manager** (exported from `~/.zshrc`): the service must still use the install's data folder, so the unit carries it; an empty one falls back to `~/.local/share`; tested in Tasks 1 and 2.
3. **An unsupported platform** (`win32`, `freebsd`): `agent:install` must say so and exit 1, not write a launchd file or crash on `process.getuid`; tested in Task 2 through `agentSpec` returning null.
4. **Reinstalling over a running unit** (after changing Node): `enable --now` leaves a running unit on its old `ExecStart`, so start reloads, enables and restarts; tested in Task 2's command list.
5. **An unknown platform's config defaults**: any platform but `darwin` takes the Linux defaults, so `loadConfig` never throws; tested in Task 1.

---

**Wave:** A holds Tasks 1 and 2. They change different files except `README.md` (Task 1: "The data folder" section and the `reporterCommand` row; Task 2: "Requirements" and "Install") and `CLAUDE.md` (Task 1: the first code convention, line 47; Task 2: the launchd convention line, 178), use nothing the other adds, and have independent tests.

### Task 1: platform defaults in `loadConfig`, and a macOS CI job

**Wave:** A

**Files:**
- Modify: `packages/server/src/config.ts` (the defaults and the doc comment)
- Test: `packages/server/test/config.test.ts`
- Modify: `.github/workflows/ci.yml` (a second job)
- Modify: `README.md` ("The data folder" section's path, and the `reporterCommand` row: the default per platform)
- Modify: `CLAUDE.md` (first code convention, line 47: the data folder (`platformDefaults` in `config.ts`), the launchd label (`LABEL`) and the systemd unit (`UNIT`, both in `agent.ts`) keep the project's first name; one line)

**Interfaces:**
- Produces: `platformDefaults(platform: NodeJS.Platform, env: Record<string, string | undefined>, home: string): { dataDir: string; python: string }` exported from `config.ts`; `loadConfig(dataDir?: string): Config` unchanged in signature, its default `dataDir` and `reporterCommand[0]` now from `platformDefaults(process.platform, process.env, homedir())`.

- [ ] **Step 1: Write the failing tests** in `config.test.ts`, a new `describe('platformDefaults', …)`:

```ts
test('macOS keeps Application Support and /usr/bin/python3', () => {
  expect(platformDefaults('darwin', {}, '/h')).toEqual({
    dataDir: join('/h', 'Library', 'Application Support', 'claude-workflow-dashboard'),
    python: '/usr/bin/python3',
  });
});
test('Linux uses XDG_DATA_HOME and python3', () => {
  expect(platformDefaults('linux', { XDG_DATA_HOME: '/xdg' }, '/h')).toEqual({
    dataDir: join('/xdg', 'claude-workflow-dashboard'),
    python: 'python3',
  });
});
test('Linux falls back to ~/.local/share when XDG_DATA_HOME is unset or empty', () => {
  for (const XDG_DATA_HOME of [undefined, '']) {
    expect(platformDefaults('linux', { XDG_DATA_HOME }, '/h').dataDir).toBe(join('/h', '.local', 'share', 'claude-workflow-dashboard'));
  }
});
test('any other platform takes the Linux defaults', () => {
  expect(platformDefaults('freebsd', {}, '/h')).toEqual(platformDefaults('linux', {}, '/h'));
});
```

The existing "defaults expand the home folder" test keeps its HOME redirect and becomes platform-independent: it expects `dataDir` and `reporterCommand[0]` from `platformDefaults(process.platform, process.env, home)`, the rest as today. On Linux, it also clears `XDG_DATA_HOME` for the test (restored in `afterEach` like `HOME`), so the data dir lands in the temp home.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run packages/server/test/config.test.ts`
Expected: FAIL, `platformDefaults` is not exported.

- [ ] **Step 3: Implement `platformDefaults` in `config.ts`** and use it for `loadConfig`'s default `dataDir` and the reporter command's interpreter (`[python, '-I', <script>, '--json']`). The folder name `claude-workflow-dashboard` is one constant used by both platforms. An unset or empty `XDG_DATA_HOME` falls back (`env.XDG_DATA_HOME || join(home, '.local', 'share')`). Update the doc comment to name both defaults.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run packages/server/test/config.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the macOS CI job** to `.github/workflows/ci.yml`: `macos`, `runs-on: macos-latest`, the same checkout, pnpm, Node (`.nvmrc`) and `pnpm install --frozen-lockfile` steps as `check`, then `pnpm -r typecheck` and `pnpm vitest run --project @cwd/server --project @cwd/shared`. Check locally that this command runs exactly those two projects (Vitest names a project after its package's `name`; if it doesn't here, use the name it prints).

- [ ] **Step 6: Update `README.md` and `CLAUDE.md`** as listed under Files.

- [ ] **Step 7: Run the whole check**

Run: `pnpm -r typecheck && pnpm vitest run --project @cwd/server --project @cwd/shared`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/config.ts packages/server/test/config.test.ts .github/workflows/ci.yml README.md CLAUDE.md
git commit -m "feat: platform defaults for the data folder and the reporter's python, and a macOS CI job"
```

### Task 2: a systemd user unit beside the launchd agent

**Wave:** A

**Files:**
- Modify: `packages/server/src/agent.ts`
- Test: `packages/server/test/agent.test.ts`
- Modify: `README.md` ("Requirements": macOS or Linux, Windows through WSL; "Install": what `agent:install` writes on each, and that a Linux user unit runs while the user is logged in unless they run `loginctl enable-linger`)
- Modify: `CLAUDE.md` (line 178 becomes two lines, one per platform, each keeping "it runs `src/main.ts` with the absolute `node` that ran `pnpm agent:install`, since there is no server bundle": the launchd plist only from the pure `plist()`, the systemd user unit only from the pure `systemdUnit()`, both chosen by `agentSpec()` in `agent.ts`; no test writes outside a temp folder or runs `launchctl` or `systemctl`)

**Interfaces:**
- Consumes: `loadConfig().dataDir` (as today, for the log folder).
- Produces, all exported from `agent.ts`:
  - `systemdUnit(opts: { node: string; entry: string; logDir: string; dataHome?: string }): string`
  - `type AgentSpec = { file: string; contents: string; start: string[][]; stop: string[][] }`
  - `agentSpec(platform: NodeJS.Platform, opts: { home: string; env: Record<string, string | undefined>; uid: number | undefined; node: string; entry: string; logDir: string }): AgentSpec | null` (null for any platform but `darwin` and `linux`).
  - `LABEL` (its value unchanged, now exported) and a new exported `UNIT = 'claude-workflow-dashboard.service'`.

- [ ] **Step 1: Write the failing tests** in `agent.test.ts`, beside the plist tests, on invented paths:

```ts
describe('systemdUnit', () => {
  test('runs node on the entry, restarts always, and logs into the data dir', () => {
    const unit = systemdUnit({ node: '/opt/node/bin/node', entry: '/repo/src/main.ts', logDir: '/data/logs' });
    expect(unit).toContain('ExecStart="/opt/node/bin/node" "/repo/src/main.ts"\n');
    expect(unit).toContain('Restart=always\n');
    expect(unit).toContain('StandardOutput=append:/data/logs/out.log\n');
    expect(unit).toContain('StandardError=append:/data/logs/err.log\n');
    expect(unit).toContain('[Install]\nWantedBy=default.target\n');
  });
  test('quotes and escapes a path with spaces, %, $, " and \\', () => {
    const unit = systemdUnit({ node: '/n/node', entry: '/My Projects/100% $HOME "x"\\y/main.ts', logDir: '/d 100%/logs' });
    expect(unit).toContain('ExecStart="/n/node" "/My Projects/100%% $$HOME \\"x\\"\\\\y/main.ts"\n');
    expect(unit).toContain('StandardOutput=append:/d 100%%/logs/out.log\n');
  });
  test("carries the install shell's XDG_DATA_HOME, and none without it", () => {
    const base = { node: '/n/node', entry: '/r/main.ts', logDir: '/d/logs' };
    expect(systemdUnit({ ...base, dataHome: '/x data' })).toContain('Environment="XDG_DATA_HOME=/x data"\n');
    expect(systemdUnit(base)).not.toContain('Environment=');
  });
});

describe('agentSpec', () => {
  const opts = { home: '/h', env: {}, uid: 501, node: '/n/node', entry: '/r/main.ts', logDir: '/d/logs' };
  test('macOS writes the plist to LaunchAgents and bootstraps it in the gui domain', () => {
    const spec = agentSpec('darwin', opts)!;
    expect(spec.file).toBe(join('/h', 'Library', 'LaunchAgents', `${LABEL}.plist`));
    expect(spec.contents).toBe(plist({ label: LABEL, node: '/n/node', entry: '/r/main.ts', logDir: '/d/logs' }));
    expect(spec.start).toEqual([['launchctl', 'bootstrap', 'gui/501', spec.file]]);
    expect(spec.stop).toEqual([['launchctl', 'bootout', `gui/501/${LABEL}`]]);
  });
  test('Linux writes a user unit under ~/.config, then reloads, enables and restarts it', () => {
    const spec = agentSpec('linux', { ...opts, env: { XDG_DATA_HOME: '/x' } })!;
    expect(spec.file).toBe(join('/h', '.config', 'systemd', 'user', UNIT));
    expect(spec.contents).toBe(systemdUnit({ node: '/n/node', entry: '/r/main.ts', logDir: '/d/logs', dataHome: '/x' }));
    expect(agentSpec('linux', { ...opts, env: { XDG_DATA_HOME: '' } })!.contents).not.toContain('Environment=');
    expect(spec.start).toEqual([
      ['systemctl', '--user', 'daemon-reload'],
      ['systemctl', '--user', 'enable', UNIT],
      ['systemctl', '--user', 'restart', UNIT],
    ]);
    expect(spec.stop).toEqual([['systemctl', '--user', 'disable', '--now', UNIT]]);
  });
  test('any other platform has no agent', () => {
    expect(agentSpec('win32', opts)).toBeNull();
    expect(agentSpec('freebsd', opts)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run packages/server/test/agent.test.ts`
Expected: FAIL, `systemdUnit` and `agentSpec` are not exported.

- [ ] **Step 3: Implement `systemdUnit` and `agentSpec` in `agent.ts`.** The unit has `[Unit]` (`Description=edward`), `[Service]` (`ExecStart`, `Restart=always`, the two `append:` log lines) and `[Install]` (`WantedBy=default.target`), plus `Environment="XDG_DATA_HOME=<dataHome>"` when `dataHome` is given (non-empty `env.XDG_DATA_HOME` in `agentSpec`). In every value, `%` becomes `%%`; each `ExecStart` argument and the `Environment=` assignment are wrapped in `"…"` with `\` and `"` escaped as `\\` and `\"`, and in `ExecStart` `$` becomes `$$`; the `append:` paths are not quoted (systemd takes the rest of the line). The unit file is always under `~/.config/systemd/user`, as the spec names it.

- [ ] **Step 4: Export `LABEL`, and rewrite the CLI block** (`if (import.meta.main)`) on `agentSpec(process.platform, { home: homedir(), env: process.env, uid: process.getuid?.(), node: process.execPath, entry, logDir })`: a null spec prints `agent:install supports macOS and Linux (Windows: use WSL)` to stderr and exits 1; `install` creates the log folder (mode `0700`) and the file's folder, writes the file, runs each `start` command in order and exits with the first non-zero status (else 0); `uninstall` runs `stop` (a not-loaded agent is fine: its status is ignored, as today) and deletes the file, the same two steps on both platforms. The header comment names both platforms.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run packages/server/test/agent.test.ts`
Expected: PASS, the four plist tests unchanged.

- [ ] **Step 6: Update `README.md` and `CLAUDE.md`** as listed under Files.

- [ ] **Step 7: Run the whole check**

Run: `pnpm -r typecheck && pnpm vitest run --project @cwd/server --project @cwd/shared`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/agent.ts packages/server/test/agent.test.ts README.md CLAUDE.md
git commit -m "feat: agent:install writes a systemd user unit on Linux"
```

## Not in this plan

- The collector mode and a second agent for it (phase 2): the agent here always runs `src/main.ts`.
- `sh`-free test tooling, Windows paths, Task Scheduler and Windows CI (phase 4).
- A manual Linux install check: the unit is tested as text; the owner may try it on their Linux server before phase 2.
