import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ShowingRequest, StatusResponse, TokenResponse } from '@cwd/shared';

/** A GET the API answered with an error status, which the page can tell apart (a 404 is an unknown key). */
export class ApiError extends Error {
  status: number;
  constructor(path: string, status: number) {
    super(`${path} answered ${status}`);
    this.status = status;
  }
}

/** The app's retries, as its query client's default: never for a 404 or a 401, which a retry won't change, else three
 * as TanStack's default. */
export function retry(failures: number, error: Error): boolean {
  return !(error instanceof ApiError && (error.status === 404 || error.status === 401)) && failures < 3;
}

/** A GET of the API; a 401 (hosted mode, signed out) sends the page to the sign-in page. */
async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (response.status === 401) window.location.assign('/signin');
  if (!response.ok) throw new ApiError(path, response.status);
  return response.json() as Promise<T>;
}

/** The import's status, polled every 10 s. */
export function useStatus() {
  return useQuery({
    queryKey: ['status'],
    queryFn: () => getJson<StatusResponse>('/api/status'),
    refetchInterval: 10_000,
  });
}

/** A GET of the API whose key holds the last good import's time, so its data refetches in place when an import lands. */
export function useLiveQuery<T>(path: string) {
  const status = useStatus();
  return useQuery({
    queryKey: [path, status.data?.lastGoodImportAt ?? null],
    queryFn: () => getJson<T>(path),
    // Wait for the status, so the first fetch already has its key; a failed status still lets the page load.
    enabled: !status.isPending,
    placeholderData: keepPreviousData,
  });
}

/** A POST to the API, with its body as JSON when given, answering its response. The header is the server's guard
 * against cross-site POSTs. */
async function post(path: string, body?: object): Promise<Response> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'X-Dashboard-Refresh': '1', ...(body && { 'Content-Type': 'application/json' }) },
    ...(body && { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(`${path} answered ${response.status}`);
  return response;
}

/** Asks the server for an import now. */
export async function refresh(): Promise<void> {
  await post('/api/refresh');
}

/** Marks everything up to now seen, so the home feed starts again from here. */
export async function markSeen(): Promise<void> {
  await post('/api/seen');
}

/** Shows only these projects in full, by key; an empty list stops showing mode. */
export async function showProjects(projects: string[]): Promise<void> {
  await post('/api/showing', { projects } satisfies ShowingRequest);
}

/** Creates a collector token (hosted mode), answering it raw, this once. */
export async function createToken(): Promise<TokenResponse> {
  return (await post('/api/account/tokens')).json() as Promise<TokenResponse>;
}

/** Revokes one of the account's collector tokens, by id. */
export async function revokeToken(id: number): Promise<void> {
  await post(`/api/account/tokens/${id}/revoke`);
}

/** Forgets the machine that feeds the account, so the next collect may come from another. */
export async function resetCollector(): Promise<void> {
  await post('/api/account/reset-collector');
}

/** Ends the session (hosted mode). */
export async function signOut(): Promise<void> {
  await post('/auth/signout');
}
