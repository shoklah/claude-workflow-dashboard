import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, test, vi } from 'vitest';
import type { ShowingResponse, StatusResponse } from '@cwd/shared';
import { mockApi } from '../test/mock-api.ts';
import { ShowingControl } from './ShowingControl.tsx';

const AT = '2026-11-12T10:00:00.000Z';
const status: StatusResponse = { lastImportAt: AT, lastGoodImportAt: AT, error: null, importing: false };
const off: ShowingResponse = { on: false, projects: [{ key: '1a2b3c4d5e6f7081', name: 'atlas', picked: false }] };

afterEach(() => {
  document.body.replaceChildren();
});

test("starting showing mode drops every page's cached data, so no page shows what the mode hides", async () => {
  const fetchSpy = mockApi({ '/api/status': status, '/api/showing': off });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // A page visited before showing mode, no longer on screen: Back would render it from the cache.
  client.setQueryData(['/api/runs/1a2b3c4d5e6f7081-9f8e7d6c5b4a3921', AT], { name: 'atlas · main' });
  const root = createRoot(document.body.appendChild(document.createElement('div')));
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <ShowingControl />
      </QueryClientProvider>,
    ),
  );

  const control = await vi.waitFor(() => {
    const element = document.querySelector<HTMLButtonElement>('[role="switch"]:not([disabled])');
    if (!element) throw new Error('no enabled switch yet');
    return element;
  });
  await act(() => control.click());
  const atlas = await vi.waitFor(() => {
    const element = document.querySelector<HTMLInputElement>('[role="dialog"] input[type="checkbox"]');
    if (!element) throw new Error('no picker yet');
    return element;
  });
  await act(() => atlas.click());
  const start = [...document.querySelectorAll('button')].find((button) => button.textContent === 'Start showing')!;
  await act(() => start.click());

  await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('/api/showing', expect.objectContaining({ method: 'POST' })));
  await vi.waitFor(() =>
    expect(client.getQueryData(['/api/runs/1a2b3c4d5e6f7081-9f8e7d6c5b4a3921', AT])).toBeUndefined(),
  );
  fetchSpy.mockRestore();
});
