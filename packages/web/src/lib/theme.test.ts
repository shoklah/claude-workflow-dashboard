import { act, createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applySystemTheme, resolveVars, useDark } from './theme.ts';

/**
 * A stand-in for `matchMedia('(prefers-color-scheme: dark)')` for the whole file, since the theme keeps the queries it
 * gets. Like a browser, each call gives a new list with its own listeners, so `lists` counts the queries made; and like
 * Chromium, a list keeps the state it last saw, which reading `matches` refreshes, and fires `change` only when the
 * system's state differs from it at the next check.
 */
let dark = false;
const lists: { seen: boolean; listeners: Set<() => void> }[] = [];
vi.spyOn(window, 'matchMedia').mockImplementation(() => {
  const list = { seen: dark, listeners: new Set<() => void>() };
  lists.push(list);
  return {
    get matches() {
      list.seen = dark;
      return dark;
    },
    addEventListener: (_: string, listener: () => void) => list.listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => list.listeners.delete(listener),
  } as unknown as MediaQueryList;
});
/** The system turns dark or light; `between` runs before the lists' next check (a render reading the state). */
function setDark(next: boolean, between?: () => void) {
  dark = next;
  between?.();
  for (const list of lists) {
    if (list.seen === dark) continue;
    list.seen = dark;
    for (const listener of [...list.listeners]) listener();
  }
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
  it("re-renders its caller in step with the root's class, from the two queries the theme keeps", async () => {
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
    expect(lists).toHaveLength(2);
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

describe('the system turning dark while a render reads the theme', () => {
  it("still turns the root dark: reading the state doesn't swallow the change", async () => {
    const stop = applySystemTheme();
    function Probe() {
      useDark();
      return null;
    }
    const root = createRoot(document.body.appendChild(document.createElement('div')));
    await act(async () => root.render(createElement(Probe)));
    await act(async () => setDark(true, () => flushSync(() => root.render(createElement(Probe, { key: 'again' })))));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    act(() => root.unmount());
    stop();
  });
});
