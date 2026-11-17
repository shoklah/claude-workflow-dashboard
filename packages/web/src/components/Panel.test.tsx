import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, test, vi } from 'vitest';
import { PageTitle, Pairs } from './Panel.tsx';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

test('two pairs with one term both render, with no key warning', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const container = document.body.appendChild(document.createElement('div'));
  await act(async () => {
    createRoot(container).render(
      <Pairs
        pairs={[
          ['Line', 'one'],
          ['Line', 'two'],
        ]}
      />,
    );
  });
  expect([...container.querySelectorAll('dd')].map((dd) => dd.textContent)).toEqual(['one', 'two']);
  expect(errors.mock.calls.filter(([message]) => String(message).includes('same key'))).toEqual([]);
});

test("a page's title names the tab, which reads the document's own title again once the page title is gone", async () => {
  const before = document.title;
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  await act(async () => root.render(<PageTitle>Sessions</PageTitle>));
  expect(document.title).toBe('Sessions - edward');
  await act(async () => root.render(<PageTitle>feat/search</PageTitle>));
  expect(document.title).toBe('feat/search - edward');
  await act(async () => root.unmount());
  expect(document.title).toBe(before);
});
