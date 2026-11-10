import { folderName, projectNames, SESSION_ID, splitSessionId, type RunFacts } from '@cwd/shared';
import { projectKey } from '../keys.ts';
import { trimPaths } from '../text.ts';
import { sessionRootOf } from './runs.ts';

/**
 * Showing mode's scope: the shown project keys, each one's display name (its alias, else its folder name), the shown
 * folder names (`kept`, kept whole where they hold a hidden name), and the folder names of every other root, runs' and
 * sessions' alike, and the hidden runs' branches, minus any string a shown project also has (as forbiddenStrings),
 * since those reveal nothing.
 */
export type Scope = {
  shown: Set<string>;
  names: Map<string, string>;
  kept: string[];
  hidden: string[];
  branches: string[];
};

// A session ID, bare or as its `<uuid>.jsonl` file.
const SESSION_IDS = new RegExp(`${SESSION_ID.source}(?:\\.jsonl)?`, 'gi');

// The strings as one regex alternation, escaped and longest first, so a longer string wins where two start together.
function anyOf(strings: string[]): string {
  const escaped = [...strings].sort((a, b) => b.length - a.length).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return `(?:${escaped.join('|')})`;
}

/**
 * The scope of showing mode's picked keys over the stored runs' branches by root and the stored sessions' roots; null
 * while showing mode is off.
 */
export function scopeOf(
  showing: string[] | null,
  branches: Map<string, string[]>,
  aliases: Record<string, string>,
  sessionRoots: string[],
): Scope | null {
  if (showing === null) return null;
  const roots = [...branches.keys()];
  const isShown = (root: string) => showing.includes(projectKey(root));
  const shownRoots = roots.filter(isShown);
  const hiddenRoots = roots.filter((root) => !isShown(root));
  const names = projectNames(shownRoots, aliases);
  const strings = forbiddenStrings(roots, branches, shownRoots, [], sessionRoots);
  const forbidden = new Set(strings.forbidden);
  const hiddenOnly = (strings: string[]) => [...new Set(strings)].filter((s) => forbidden.has(s));
  return {
    shown: new Set(shownRoots.map(projectKey)),
    names: new Map(shownRoots.map((root) => [projectKey(root), names.get(root)!])),
    kept: strings.shown,
    hidden: hiddenOnly([...hiddenRoots, ...sessionRoots].map(folderName)),
    branches: hiddenOnly(hiddenRoots.flatMap((root) => branches.get(root) ?? [])),
  };
}

/**
 * A text as showing mode lets it out: its paths trimmed (trimPaths), each session ID, bare or as `<uuid>.jsonl`,
 * written "a session", and each whole-word hidden branch and project name, in any case, written "another branch" and
 * "another project", unless it is part of a whole-word shown folder name (kept), which stays as it is. A word holds
 * letters, digits and `_`, so `-` ends one, as in a transcript folder's `-Users-me-Work-<name>`. With no scope, or no
 * text, the text as it is.
 */
export function maskText<T extends string | null | undefined>(scope: Scope | null, text: T): T {
  if (!scope || !text) return text;
  const masked = trimPaths(text).replace(SESSION_IDS, 'a session');
  // By lower case, a mask wins over a kept string, and a branch's over a name's.
  const masks = new Map<string, string | null>([
    ...scope.kept.map((word): [string, null] => [word.toLowerCase(), null]),
    ...scope.hidden.map((word): [string, string] => [word.toLowerCase(), 'another project']),
    ...scope.branches.map((word): [string, string] => [word.toLowerCase(), 'another branch']),
  ]);
  if (masks.size === 0) return masked as T;
  const words = new RegExp(`(?<!\\w)${anyOf([...masks.keys()])}(?!\\w)`, 'gi');
  return masked.replace(words, (word) => masks.get(word.toLowerCase()) ?? word) as T;
}

/**
 * A run's facts as a view shows them: with a scope, null for a hidden project's run, else named by the scope, with its
 * branch masked (maskText).
 */
export function showFacts(scope: Scope | null, facts: RunFacts): RunFacts | null {
  if (!scope) return facts;
  if (!scope.shown.has(facts.projectKey)) return null;
  const branch = maskText(scope, facts.branch);
  return { ...facts, project: scope.names.get(facts.projectKey)!, branch };
}

/**
 * Whether a view lists a session, or its warning, by its project: with a scope, only in a shown root (sessionRootOf).
 */
export function showSession(scope: Scope | null, project: string | null | undefined): boolean {
  const root = sessionRootOf(project);
  return !scope || (root !== null && scope.shown.has(projectKey(root)));
}

/** A warning as a view shows it: with a scope, its masked text and no session ID; else split by splitSessionId. */
export function showWarning(scope: Scope | null, text: string): { text: string; sessionId: string | null } {
  return scope ? { text: maskText(scope, text), sessionId: null } : splitSessionId(text);
}

/**
 * The forbidden strings found in the JSON, but not those found only inside a shown string (forbiddenStrings): the leak
 * check of the views' tests and check:real.
 */
export function leaks(json: unknown, forbidden: string[], shown: string[]): string[] {
  if (forbidden.length === 0) return [];
  const hidden = new Set(forbidden);
  const found = JSON.stringify(json).match(new RegExp(anyOf([...forbidden, ...shown]), 'g')) ?? [];
  return [...new Set(found.filter((s) => hidden.has(s)))];
}

/**
 * What no showing-mode response may hold (`forbidden`): the hidden roots, runs' and sessions' alike, their folder
 * names and their branches (by root), minus any string a shown root or a shown run also has, plus the session IDs.
 * `shown` is the shown roots' folder names, which may hold a forbidden string without revealing it.
 */
export function forbiddenStrings(
  roots: string[],
  branches: Map<string, string[]>,
  shownRoots: string[],
  sessionIds: string[],
  sessionRoots: string[],
): { forbidden: string[]; shown: string[] } {
  const strings = (root: string) => [root, folderName(root), ...(branches.get(root) ?? [])];
  const shown = new Set(shownRoots.flatMap(strings));
  const hidden = [...roots, ...sessionRoots].filter((root) => !shownRoots.includes(root)).flatMap(strings);
  return {
    forbidden: [...new Set([...hidden.filter((s) => s && !shown.has(s)), ...sessionIds])],
    shown: [...new Set(shownRoots.map(folderName))].filter(Boolean),
  };
}
