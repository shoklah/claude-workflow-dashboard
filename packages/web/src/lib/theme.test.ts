import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applySystemTheme, resolveVars, useDark } from './theme.ts';

/**
 * A stand-in for `matchMedia('(prefers-color-scheme: dark)')` for the whole file, since the theme keeps the first query
 * it gets. Like a browser, each call gives a new list with its own listeners, so `lists` counts the queries made.
 */
let dark = false;
const lists: Set<() => void>[] = [];
vi.spyOn(window, 'matchMedia').mockImplementation(() => {
  const listeners = new Set<() => void>();
  lists.push(listeners);
  return {
    get matches() {
      return dark;
    },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  } as unknown as MediaQueryList;
});
function setDark(next: boolean) {
  dark = next;
  for (const listeners of lists) for (const listener of [...listeners]) listener();
}

afterEach(() => {
  setDark(false);
  document.documentElement.classList.remove('dark');
  document.documentElement.style.removeProperty('--test-colour');
  document.body.replaceChildren();
});

describe('applySystemTheme', () => {
  it("puts the dark class on the root when the system is dark, and follows the system's changes", () => {
    setDark(true);
    const stop = applySystemTheme();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    setDark(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    setDark(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    stop();
    setDark(false);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('leaves the root light when the system is light', () => {
    applySystemTheme()();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});

describe('useDark', () => {
  it("re-renders its caller in step with the root's class, from the one query the theme shares", async () => {
    const stop = applySystemTheme();
    const seen: [boolean, boolean][] = [];
    function Probe() {
      seen.push([useDark(), document.documentElement.classList.contains('dark')]);
      return null;
    }
    const root = createRoot(document.body.appendChild(document.createElement('div')));
    await act(async () => root.render(createElement(Probe)));
    await act(async () => setDark(true));
    expect(seen.at(-1)).toEqual([true, true]);
    expect(lists).toHaveLength(1);
    act(() => root.unmount());
    stop();
  });
});

describe('resolveVars', () => {
  it("replaces each var() string, however deep, with the root's current value and keeps everything else", () => {
    document.documentElement.style.setProperty('--test-colour', ' #123456 ');
    const formatter = () => 'label';
    const resolved = resolveVars({
      color: 'var(--test-colour)',
      series: [{ itemStyle: { color: 'var(--test-colour)' }, data: [1, null, 3] }],
      label: { formatter },
      name: 'Plan',
    });
    expect(resolved.color).toBe('#123456');
    expect(resolved.series[0].itemStyle.color).toBe('#123456');
    expect(resolved.series[0].data).toEqual([1, null, 3]);
    expect(resolved.label.formatter).toBe(formatter);
    expect(resolved.name).toBe('Plan');
  });

  it("reads the root's computed style once per call", () => {
    const getComputedStyle = vi.spyOn(window, 'getComputedStyle');
    resolveVars({ a: 'var(--a)', b: ['var(--b)', 'var(--c)'] });
    expect(getComputedStyle).toHaveBeenCalledTimes(1);
    getComputedStyle.mockRestore();
  });
});
