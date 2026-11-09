import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { StatusResponse } from '@cwd/shared';

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} answered ${response.status}`);
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

/** Asks the server for an import now. The header is the server's guard against cross-site POSTs. */
export async function refresh(): Promise<void> {
  const response = await fetch('/api/refresh', { method: 'POST', headers: { 'X-Dashboard-Refresh': '1' } });
  if (!response.ok) throw new Error(`/api/refresh answered ${response.status}`);
}
