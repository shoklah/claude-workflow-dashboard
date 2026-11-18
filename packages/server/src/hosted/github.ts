/** GitHub's OAuth web flow: where to send the browser, and the signed-in user a callback's code names. */
export type GitHubClient = {
  authorizeUrl(state: string, redirectUri: string): string;
  user(code: string, redirectUri: string): Promise<{ id: number; login: string }>;
};

/**
 * The GitHub client of an OAuth app. `user` trades the code for an access token (the client secret only in that POST's
 * body), then reads the user with it; any failure throws the fixed `GitHub sign-in failed`, with nothing from GitHub's
 * reply, so no code, token or secret reaches an error text.
 */
export function githubClient({
  clientId,
  clientSecret,
  fetch = globalThis.fetch,
}: {
  clientId: string;
  clientSecret: string;
  fetch?: typeof globalThis.fetch;
}): GitHubClient {
  return {
    authorizeUrl(state, redirectUri) {
      // No scope: the public profile is enough.
      const query = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, state, scope: '' });
      return `https://github.com/login/oauth/authorize?${query}`;
    },
    async user(code, redirectUri) {
      try {
        const token = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
        });
        if (!token.ok) throw new Error();
        const { access_token } = (await token.json()) as { access_token?: unknown };
        if (typeof access_token !== 'string' || !access_token) throw new Error();
        const res = await fetch('https://api.github.com/user', {
          headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${access_token}`, 'User-Agent': 'edward' },
        });
        if (!res.ok) throw new Error();
        const { id, login } = (await res.json()) as { id?: unknown; login?: unknown };
        if (typeof id !== 'number' || typeof login !== 'string') throw new Error();
        return { id, login };
      } catch {
        throw new Error('GitHub sign-in failed');
      }
    },
  };
}
