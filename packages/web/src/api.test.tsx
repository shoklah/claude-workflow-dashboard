import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, test, vi } from 'vitest';
import { ApiError, retry, useLiveQuery } from './api.ts';

let lastGoodImportAt = '2026-11-12T10:00:00.000Z';
let thingFetches = 0;

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

/** Renders a live query of `/api/thing`, answered with `status` when given, and returns every value its data took, its
 * last error, and the query client (the app's, which retries). */
function renderLiveQuery(status?: number) {
  lastGoodImportAt = '2026-11-12T10:00:00.000Z';
  thingFetches = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    if (input === '/api/status') {
      return Response.json({ lastImportAt: lastGoodImportAt, lastGoodImportAt, error: null, importing: false });
    }
    ++thingFetches;
    return status ? new Response(null, { status }) : Response.json({ fetch: thingFetches });
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry } } });
  const seen: (number | undefined)[] = [];
  const errors: (Error | null)[] = [];
  function Probe() {
    const query = useLiveQuery<{ fetch: number }>('/api/thing');
    seen.push(query.data?.fetch);
    errors.push(query.error);
    return null;
  }
  const root = createRoot(document.body.appendChild(document.createElement('div')));
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    ),
  );
  return { seen, errors, client };
}

test('a live query refetches in place when a new import lands', async () => {
  const { seen, client } = renderLiveQuery();
  await vi.waitFor(() => expect(seen.at(-1)).toBe(1));

  lastGoodImportAt = '2026-11-12T11:00:00.000Z';
  await act(() => client.invalidateQueries({ queryKey: ['status'] }));

  await vi.waitFor(() => expect(seen.at(-1)).toBe(2));
  expect(seen.slice(seen.indexOf(1))).not.toContain(undefined);
});

test('a live query keeps its data while the last good import is the same', async () => {
  const { seen, client } = renderLiveQuery();
  await vi.waitFor(() => expect(seen.at(-1)).toBe(1));

  await act(() => client.invalidateQueries({ queryKey: ['status'] }));

  expect(thingFetches).toBe(1);
});

test('a 404 is fetched once and gives an ApiError with its status', async () => {
  const { errors } = renderLiveQuery(404);
  await vi.waitFor(() => expect(errors.at(-1)).toBeInstanceOf(ApiError));
  expect((errors.at(-1) as ApiError).status).toBe(404);
  expect(thingFetches).toBe(1);
});

test('a 500 is still retried', async () => {
  renderLiveQuery(500);
  // The client waits a second before its first retry.
  await vi.waitFor(() => expect(thingFetches).toBe(2), { timeout: 3000 });
});
