import { useSyncExternalStore } from 'react';

// The theme follows the system: DESIGN.md's dark look (`.dark` on the root) when it is dark, its light pair otherwise.
// One query serves the class and every `useDark`.
let scheme: MediaQueryList | undefined;
const darkScheme = () => (scheme ??= window.matchMedia('(prefers-color-scheme: dark)'));

const subscribe = (onChange: () => void) => {
  const query = darkScheme();
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};

/** Sets the root's `dark` class from the system's colour scheme and keeps it in step; returns the function that stops. */
export function applySystemTheme(): () => void {
  const apply = () => document.documentElement.classList.toggle('dark', darkScheme().matches);
  apply();
  return subscribe(apply);
}

/** Whether the system is dark, re-rendering its caller when that changes (the charts redraw in the other theme's colours). */
export function useDark(): boolean {
  return useSyncExternalStore(subscribe, () => darkScheme().matches);
}

/**
 * A chart option with every `var(--name)` string, however deep, replaced by the root's current value of that token:
 * ECharts' SVG attributes can't hold `var()`. Functions, numbers and other strings are kept as they are.
 */
export function resolveVars<T>(value: T): T {
  const style = getComputedStyle(document.documentElement);
  const resolve = (item: unknown): unknown => {
    if (typeof item === 'string' && item.startsWith('var(')) return style.getPropertyValue(item.slice(4, -1)).trim();
    if (Array.isArray(item)) return item.map(resolve);
    if (item && typeof item === 'object' && Object.getPrototypeOf(item) === Object.prototype) {
      return Object.fromEntries(Object.entries(item).map(([key, entry]) => [key, resolve(entry)]));
    }
    return item;
  };
  return resolve(value) as T;
}
