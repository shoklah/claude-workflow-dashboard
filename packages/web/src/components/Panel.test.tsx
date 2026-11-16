import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, test, vi } from 'vitest';
import { Pairs } from './Panel.tsx';

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
