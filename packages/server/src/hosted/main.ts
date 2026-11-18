// Hosted mode: the settings from the data folder's `.env`, the hosted app's deps, and the server on every interface
// (inside its container, behind a reverse proxy).
import { join } from 'node:path';
import { builtWebDist, serveApp, type AppDeps, type HostedDeps } from '../app.ts';
import type { Config } from '../config.ts';
import { openAccountsDb } from './accounts.ts';
import { accountFiles } from './account-files.ts';
import { githubClient, type GitHubClient } from './github.ts';

const NAMES = ['EDWARD_PUBLIC_HOST', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'EDWARD_ADMIN'] as const;

/** Hosted mode's settings; a missing or empty one throws, naming every missing variable and never a value. */
export function hostedSettings(env: Record<string, string | undefined>): {
  publicHost: string;
  clientId: string;
  clientSecret: string;
  admin: string;
} {
  const settings = {
    publicHost: env.EDWARD_PUBLIC_HOST ?? '',
    clientId: env.GITHUB_CLIENT_ID ?? '',
    clientSecret: env.GITHUB_CLIENT_SECRET ?? '',
    admin: env.EDWARD_ADMIN ?? '',
  };
  const missing = NAMES.filter((name) => !env[name]);
  if (missing.length) throw new Error(`hosted mode needs ${missing.join(', ')} in the data folder's .env`);
  return settings;
}

/** The hosted app's deps over `dataDir`: its `accounts.sqlite` and account files, no local database, no refresh, no
 * aliases and no labeller. The one place they are built. */
export function hostedDeps(opts: {
  dataDir: string;
  port: number;
  publicHost: string;
  origin: string;
  admin: string;
  github: GitHubClient;
  webDist: string | null;
  now: () => Date;
}): AppDeps & { hosted: HostedDeps } {
  const { dataDir, port, publicHost, origin, admin, github, webDist, now } = opts;
  return {
    db: null,
    port,
    requestImport: null,
    importing: () => false,
    webDist,
    now,
    aliases: {},
    labeller: null,
    hosted: {
      publicHost,
      origin,
      accounts: openAccountsDb(join(dataDir, 'accounts.sqlite')),
      files: accountFiles(dataDir),
      admin,
      github,
    },
  };
}

/** Serves hosted mode on 0.0.0.0, the container's port; throws naming any missing setting. */
export function runHosted(config: Config, env: Record<string, string | undefined>): void {
  const { publicHost, clientId, clientSecret, admin } = hostedSettings(env);
  const deps = hostedDeps({
    dataDir: config.dataDir,
    port: config.port,
    publicHost,
    origin: `https://${publicHost}`,
    admin,
    github: githubClient({ clientId, clientSecret }),
    webDist: builtWebDist(),
    now: () => new Date(),
  });
  serveApp(deps, '0.0.0.0');
}
