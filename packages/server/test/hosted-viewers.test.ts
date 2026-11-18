import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  loadReport,
  type AccountResponse,
  type HomeResponse,
  type RunsResponse,
  type ShowingResponse,
  type StatusResponse,
} from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { importReport } from '../src/db/import.ts';
import { getSeenAt, getShowing, getShownProjects, listUnits, setShownProjects } from '../src/db/read.ts';
import type { Db } from '../src/db/open.ts';
import {
  addInvite,
  addViewer,
  createSession,
  createToken,
  listTokens,
  removeViewer,
  SESSION,
  signInAccount,
} from '../src/hosted/accounts.ts';
import { changeKey, goalKey, projectKey } from '../src/keys.ts';
import { storedBranches, storedSessionRoots } from '../src/views/runs.ts';
import { forbiddenStrings, leaks } from '../src/views/scope.ts';
import { goalHomes, levels } from '../src/views/work.ts';
import { hostedApp, NOW, ORIGIN, PUBLIC_HOST } from './hosted-helpers.ts';

// report-work's roots: the owner keeps lantern-notes shown, with showing mode off; tidepool-api and Scratch/lantern
// stay hidden.
const LANTERN = '/Users/example/Work/lantern-notes';
const TIDEPOOL = '/Users/example/Work/tidepool-api';
const OFFLINE_CHANGE = changeKey(
  { project: LANTERN, path: 'docs/superpowers/specs/2026-11-05-offline-sync-design.md' },
  null,
  '',
  '',
);
const WEBHOOKS_CHANGE = changeKey(
  { project: TIDEPOOL, path: 'docs/superpowers/specs/2026-11-11-webhooks-design.md' },
  null,
  '',
  '',
);
const OFFLINE_RUN = '97d6367dec7d9739';
const RETRY_RUN = '4ff383286fce4ac9'; // fix/retry-backoff, in tidepool-api

const OWNER = { id: 101, login: 'rowan-k' };
const VIEWER = { id: 202, login: 'mika-ito' };

let dir: string;
let hosted: ReturnType<typeof hostedApp>;
let ownerCookie: string;
let viewerCookie: string;

const db = (id: number): Db => hosted.hosted.files.db(id);

function load(target: Db, name: string) {
  const raw = fixture(name);
  const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
  if (!loaded.ok) throw new Error(`${name} does not load`);
  importReport(target, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, NOW);
}

function get(path: string, cookie = viewerCookie) {
  return hosted.app.request(path, { headers: { Host: PUBLIC_HOST, Cookie: cookie } });
}

async function json<T>(path: string, cookie = viewerCookie): Promise<T> {
  const res = await get(path, cookie);
  expect(res.status, path).toBe(200);
  return (await res.json()) as T;
}

function post(path: string, body?: unknown, cookie = viewerCookie) {
  return hosted.app.request(path, {
    method: 'POST',
    headers: {
      Host: PUBLIC_HOST,
      Cookie: cookie,
      'X-Dashboard-Refresh': '1',
      Origin: ORIGIN,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const view = (login: string | null) => post('/api/view', { login });

/** What a response showing only lantern-notes of report-work may not hold. */
function forbidden() {
  const raw = fixture('report-work');
  const runs = listUnits(db(OWNER.id), 'run');
  const sessions = listUnits(db(OWNER.id), 'session');
  const branches = storedBranches(runs);
  const sessionIds = [
    ...new Set(JSON.stringify(raw).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)),
  ];
  const strings = forbiddenStrings(
    [...branches.keys()],
    branches,
    [LANTERN],
    sessionIds,
    storedSessionRoots(sessions),
    goalHomes(levels(runs, sessions)),
  );
  return { forbidden: [...strings.forbidden, '/Users/example'], shown: strings.shown };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cwd viewers '));
  hosted = hostedApp(join(dir, 'data'));
  const { accounts } = hosted.hosted;
  addInvite(accounts, OWNER.login, NOW);
  signInAccount(accounts, OWNER, 'admin', NOW);
  // Granted before the viewer's account exists: bound at its first sign-in.
  addViewer(accounts, OWNER.id, VIEWER.login);
  addInvite(accounts, VIEWER.login, NOW);
  signInAccount(accounts, VIEWER, 'admin', NOW);
  ownerCookie = `${SESSION}=${createSession(accounts, OWNER.id, NOW)}`;
  viewerCookie = `${SESSION}=${createSession(accounts, VIEWER.id, NOW)}`;
  createToken(accounts, VIEWER.id, NOW);
  load(db(OWNER.id), 'report-work');
  setShownProjects(db(OWNER.id), [projectKey(LANTERN)]);
  load(db(VIEWER.id), 'report-projects');
});

afterEach(() => {
  hosted.close();
  rmSync(dir, { recursive: true, force: true });
});

const PAGES = [
  '/api/home',
  '/api/runs?weeks=52',
  `/api/runs/${OFFLINE_RUN}`,
  '/api/work?weeks=52',
  '/api/findings?weeks=52',
  '/api/sessions?weeks=52',
  '/api/context?weeks=52',
  '/api/spend?weeks=52',
  '/api/compliance?weeks=52',
  '/api/steps?weeks=52',
  '/api/skills?weeks=52',
  '/api/models?weeks=52',
  '/api/weeks?weeks=52',
  '/api/status',
  '/api/showing',
  `/api/work/changes/${OFFLINE_CHANGE}`,
  `/api/work/goals/${goalKey('Offline sync')}`,
];

describe('a viewer of an account', () => {
  test("sees no hidden project's name, path, branch or session ID on any page, with showing mode off", async () => {
    expect(getShowing(db(OWNER.id))).toBeNull();
    expect((await view('Rowan-K')).status).toBe(204);
    const { forbidden: strings, shown } = forbidden();
    for (const path of PAGES) {
      const body = await json(path);
      expect(leaks(body, strings, shown), path).toEqual([]);
    }
  });

  test("lists the shown project's runs, and counts every project as the owner's own counts do", async () => {
    await view('rowan-k');
    const owner = await json<RunsResponse>('/api/runs?weeks=52', ownerCookie);
    const viewer = await json<RunsResponse>('/api/runs?weeks=52');
    const shown = owner.runs.filter((run) => run.projectKey === projectKey(LANTERN));
    expect(shown.length).toBeGreaterThan(0);
    expect(viewer.runs.map((run) => run.key)).toEqual(shown.map((run) => run.key));
    expect(viewer.hidden).toBe(owner.runs.length - shown.length);
    expect(await json('/api/weeks?weeks=52')).toEqual(await json('/api/weeks?weeks=52', ownerCookie));
    const home = await json<HomeResponse>('/api/home');
    const ownHome = await json<HomeResponse>('/api/home', ownerCookie);
    expect(home.thisWeek).toEqual(ownHome.thisWeek);
    expect(home.charts).toEqual(ownHome.charts);
  });

  test("a hidden project's run and change are 404s", async () => {
    await view('rowan-k');
    expect((await get(`/api/runs/${RETRY_RUN}`)).status).toBe(404);
    expect((await get(`/api/work/changes/${WEBHOOKS_CHANGE}`)).status).toBe(404);
    expect((await get(`/api/runs/${RETRY_RUN}`, ownerCookie)).status).toBe(200);
  });

  test('with an empty kept list, every list is empty', async () => {
    setShownProjects(db(OWNER.id), []);
    await view('rowan-k');
    expect((await json<RunsResponse>('/api/runs?weeks=52')).runs).toEqual([]);
    expect((await json<{ goals: unknown[] }>('/api/work?weeks=52')).goals).toEqual([]);
    expect((await json<{ sessions: unknown[] }>('/api/sessions?weeks=52')).sessions).toEqual([]);
    expect((await json<HomeResponse>('/api/home')).feed).toEqual([]);
  });

  test('its status names the viewed login and the viewable ones; showing is on with the kept list (R2)', async () => {
    expect((await json<StatusResponse>('/api/status')).account).toEqual({
      login: 'mika-ito',
      viewing: null,
      viewable: ['rowan-k'],
    });
    await view('rowan-k');
    expect((await json<StatusResponse>('/api/status')).account).toEqual({
      login: 'mika-ito',
      viewing: 'rowan-k',
      viewable: ['rowan-k'],
    });
    expect(await json<ShowingResponse>('/api/showing')).toEqual({
      on: true,
      projects: [{ key: projectKey(LANTERN), name: 'lantern-notes', picked: true }],
    });
  });

  test("can't change the viewed account: every POST but /api/view and sign-out is a 403", async () => {
    await view('rowan-k');
    const seenAt = getSeenAt(db(OWNER.id));
    for (const path of [
      '/api/seen',
      '/api/showing',
      '/api/showing/projects',
      '/api/account/tokens',
      '/api/account/reset-collector',
      '/api/account/viewers',
    ]) {
      expect((await post(path, { projects: [projectKey(LANTERN)], login: 'someone' })).status, path).toBe(403);
    }
    expect(getSeenAt(db(OWNER.id))).toEqual(seenAt);
    expect(getShowing(db(OWNER.id))).toBeNull();
    expect(getShownProjects(db(OWNER.id))).toEqual([projectKey(LANTERN)]);
    expect(listTokens(hosted.hosted.accounts, VIEWER.id)).toHaveLength(1);
    expect((await view(null)).status).toBe(204);
    expect((await json<StatusResponse>('/api/status')).account?.viewing).toBeNull();
    await view('rowan-k');
    expect((await post('/auth/signout')).status).toBe(204);
  });

  test("its account page is its own", async () => {
    await view('rowan-k');
    const account = await json<AccountResponse>('/api/account');
    expect(account.login).toBe('mika-ito');
    expect(account.tokens.map((t) => t.id)).toEqual(listTokens(hosted.hosted.accounts, VIEWER.id).map((t) => t.id));
    expect(account.viewers).toEqual([]);
  });

  test('after the grant is removed, the next request is its own account again', async () => {
    const own = await json<HomeResponse>('/api/home');
    await view('rowan-k');
    expect(await json<HomeResponse>('/api/home')).not.toEqual(own);
    removeViewer(hosted.hosted.accounts, OWNER.id, 'mika-ito');
    expect((await json<StatusResponse>('/api/status')).account).toMatchObject({ viewing: null, viewable: [] });
    expect(await json<HomeResponse>('/api/home')).toEqual(own);
  });

  test("a login after a rename keeps its grant; a newcomer on the old login views nothing", async () => {
    const { accounts } = hosted.hosted;
    signInAccount(accounts, { id: VIEWER.id, login: 'mika-renamed' }, 'admin', NOW);
    expect((await view('rowan-k')).status).toBe(204);
    const newcomer = signInAccount(accounts, { id: 303, login: 'mika-ito' }, 'admin', NOW)!;
    const cookie = `${SESSION}=${createSession(accounts, newcomer.id, NOW)}`;
    expect((await post('/api/view', { login: 'rowan-k' }, cookie)).status).toBe(404);
    expect((await json<StatusResponse>('/api/status', cookie)).account).toMatchObject({ viewing: null, viewable: [] });
  });

  test("viewing an owner that didn't grant, or an unknown login, is a 404", async () => {
    expect((await post('/api/view', { login: 'mika-ito' }, ownerCookie)).status).toBe(404);
    expect((await view('nobody')).status).toBe(404);
    expect((await post('/api/view', { login: 7 })).status).toBe(400);
  });
});

describe("an owner's viewers", () => {
  test('are added by GitHub login, listed lower-case on the account page and removed', async () => {
    expect((await post('/api/account/viewers', { login: 'Sam-Lee' }, ownerCookie)).status).toBe(204);
    const viewers = async () => (await json<AccountResponse>('/api/account', ownerCookie)).viewers;
    expect(await viewers()).toEqual(['mika-ito', 'sam-lee']);
    expect((await post('/api/account/viewers/Sam-Lee/remove', undefined, ownerCookie)).status).toBe(204);
    expect(await viewers()).toEqual(['mika-ito']);
  });

  test.each(['', 'a b', 'x'.repeat(40), 'sam_lee', null])('a login %j is a 400', async (login) => {
    expect((await post('/api/account/viewers', { login }, ownerCookie)).status).toBe(400);
  });

  test.each(['/api/view', '/api/account/viewers', '/api/account/viewers/sam-lee/remove'])(
    'GET %s is a 405',
    async (path) => {
      expect((await get(path)).status).toBe(405);
    },
  );
});
