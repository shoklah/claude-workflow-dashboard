import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ShowingRequest, StatusResponse } from '@cwd/shared';

/** A GET the API answered with an error status, which the page can tell apart (a 404 is an unknown key). */
export class ApiError extends Error {
  status: number;
  constructor(path: string, status: number) {
    super(`${path} answered ${status}`);
    this.status = status;
  }
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
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
  // The client's own retries (three by default, none in the stories), but never for a 404, which a retry won't change.
  const retry = useQueryClient().getDefaultOptions().queries?.retry ?? 3;
  return useQuery({
    queryKey: [path, status.data?.lastGoodImportAt ?? null],
    queryFn: () => getJson<T>(path),
    // Wait for the status, so the first fetch already has its key; a failed status still lets the page load.
    enabled: !status.isPending,
    placeholderData: keepPreviousData,
    retry: (failures: number, error: Error) =>
      !(error instanceof ApiError && error.status === 404) &&
      (typeof retry === 'function' ? retry(failures, error) : typeof retry === 'number' ? failures < retry : retry),
  });
}

/** A POST to the API, with its body as JSON when given. The header is the server's guard against cross-site POSTs. */
async function post(path: string, body?: object): Promise<void> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'X-Dashboard-Refresh': '1', ...(body && { 'Content-Type': 'application/json' }) },
    ...(body && { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(`${path} answered ${response.status}`);
}

/** Asks the server for an import now. */
export function refresh(): Promise<void> {
  return post('/api/refresh');
}

/** Marks everything up to now seen, so the home feed starts again from here. */
export function markSeen(): Promise<void> {
  return post('/api/seen');
}

/** Shows only these projects in full, by key; an empty list stops showing mode. */
export function showProjects(projects: string[]): Promise<void> {
  return post('/api/showing', { projects } satisfies ShowingRequest);
}
