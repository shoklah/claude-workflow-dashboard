import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, test, vi } from 'vitest';
import { useLiveQuery } from './api.ts';

let lastGoodImportAt = '2026-11-12T10:00:00.000Z';
let thingFetches = 0;

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

/** Renders a live query of `/api/thing` and returns every value its data took, and the query client. */
function renderLiveQuery() {
  lastGoodImportAt = '2026-11-12T10:00:00.000Z';
  thingFetches = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    if (input === '/api/status') {
      return Response.json({ lastImportAt: lastGoodImportAt, lastGoodImportAt, error: null, importing: false });
    }
    return Response.json({ fetch: ++thingFetches });
  });
  const client = new QueryClient();
  const seen: (number | undefined)[] = [];
  function Probe() {
    seen.push(useLiveQuery<{ fetch: number }>('/api/thing').data?.fetch);
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
  return { seen, client };
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
