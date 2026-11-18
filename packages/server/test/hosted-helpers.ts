import { join } from 'node:path';
import type { Hono } from 'hono';
import { createApp, type AppEnv, type HostedDeps } from '../src/app.ts';
import { openAccountsDb } from '../src/hosted/accounts.ts';
import { accountFiles } from '../src/hosted/account-files.ts';
import { githubClient, type GitHubClient } from '../src/hosted/github.ts';

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

/** Hosted mode's deps over `dir`: its `accounts.sqlite` and account files; `close` closes both. */
export function hostedDeps(dir: string): { hosted: HostedDeps; close(): void } {
  const accounts = openAccountsDb(join(dir, 'accounts.sqlite'));
  const files = accountFiles(dir);
  return {
    hosted: { publicHost: PUBLIC_HOST, origin: ORIGIN, accounts, files, admin: 'admin', github: stubGitHub },
    close() {
      files.close();
      accounts.$client.close();
    },
  };
}

/** A hosted app over `dir`, its clock at NOW, serving `webDist` when given. */
export function hostedApp(
  dir: string,
  { webDist }: { webDist?: string } = {},
): { app: Hono<AppEnv>; hosted: HostedDeps; close(): void } {
  const { hosted, close } = hostedDeps(dir);
  const app = createApp({
    db: null,
    port: 0,
    requestImport: null,
    importing: () => false,
    webDist: webDist ?? null,
    now: () => NOW,
    aliases: {},
    labeller: null,
    hosted,
  });
  return { app, hosted, close };
}
