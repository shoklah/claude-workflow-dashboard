import type { Hono } from 'hono';
import { createApp, type AppEnv, type HostedDeps } from '../src/app.ts';
import { addInvite, createSession, createToken, signInAccount } from '../src/hosted/accounts.ts';
import { SESSION } from '../src/hosted/auth.ts';
import { githubClient, type GitHubClient } from '../src/hosted/github.ts';
import { hostedDeps } from '../src/hosted/main.ts';

// Test only: a hosted app over a temp data folder.
export const PUBLIC_HOST = 'edward.example';
export const ORIGIN = `https://${PUBLIC_HOST}`;
export const NOW = new Date('2026-11-12T12:00:00Z');

/** The stub GitHub's users, by the code that signs each in; any other code throws as the client does. */
export const GITHUB_USERS: Record<string, { id: number; login: string }> = {
  'code-alice': { id: 101, login: 'Alice' },
  'code-mallory': { id: 666, login: 'mallory' },
};

/** A GitHub client that never calls GitHub: the real authorize URL, and `user` from GITHUB_USERS. */
const stubGitHub: GitHubClient = {
  authorizeUrl: githubClient({ clientId: 'test-client-id', clientSecret: 'test-client-secret' }).authorizeUrl,
  async user(code) {
    const user = GITHUB_USERS[code];
    if (!user) throw new Error('GitHub sign-in failed');
    return user;
  },
};

/** A hosted app over `dir`, built through `hostedDeps`, its clock at NOW, serving `webDist` when given; `close`
 * closes its databases. */
export function hostedApp(
  dir: string,
  { webDist }: { webDist?: string } = {},
): { app: Hono<AppEnv>; hosted: HostedDeps; close(): void } {
  const deps = hostedDeps({
    dataDir: dir,
    port: 0,
    publicHost: PUBLIC_HOST,
    origin: ORIGIN,
    admin: 'admin',
    github: stubGitHub,
    webDist: webDist ?? null,
    now: () => NOW,
  });
  const hosted = deps.hosted;
  return {
    app: createApp(deps),
    hosted,
    close() {
      hosted.files.close();
      hosted.accounts.$client.close();
    },
  };
}

/** Two invited, signed-in accounts. */
export const A = { id: 101, login: 'Alice' };
export const B = { id: 202, login: 'bob' };

/** Signs A and B in on `hosted`, each with a collector token and a session; returns A's and B's tokens and A's cookie. */
export function twoAccounts(hosted: HostedDeps): { tokenA: string; tokenB: string; cookieA: string } {
  for (const user of [A, B]) {
    addInvite(hosted.accounts, user.login, NOW);
    signInAccount(hosted.accounts, user, 'admin', NOW);
  }
  const cookieA = `${SESSION}=${createSession(hosted.accounts, A.id, NOW)}`;
  createSession(hosted.accounts, B.id, NOW);
  return {
    tokenA: createToken(hosted.accounts, A.id, NOW),
    tokenB: createToken(hosted.accounts, B.id, NOW),
    cookieA,
  };
}
