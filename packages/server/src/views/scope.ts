import { folderName, projectNames, SESSION_ID, splitSessionId, type RunFacts } from '@cwd/shared';
import { projectKey } from '../keys.ts';
import { trimPaths } from '../text.ts';

/**
 * Showing mode's scope: the shown project keys, each one's display name (its alias, else its folder name), and the
 * hidden projects' folder names and branches, minus any string a shown project also has (as forbiddenStrings), since
 * those reveal nothing.
 */
export type Scope = { shown: Set<string>; names: Map<string, string>; hidden: string[]; branches: string[] };

// A session ID, bare or as its `<uuid>.jsonl` file.
const SESSION_IDS = new RegExp(`${SESSION_ID.source}(?:\\.jsonl)?`, 'gi');

/** The scope of showing mode's picked keys over the stored runs' branches by root; null while showing mode is off. */
export function scopeOf(
  showing: string[] | null,
  branches: Map<string, string[]>,
  aliases: Record<string, string>,
): Scope | null {
  if (showing === null) return null;
  const roots = [...branches.keys()];
  const isShown = (root: string) => showing.includes(projectKey(root));
  const shownRoots = roots.filter(isShown);
  const hiddenRoots = roots.filter((root) => !isShown(root));
  const names = projectNames(shownRoots, aliases);
  const forbidden = new Set(forbiddenStrings(roots, branches, shownRoots, []));
  const hiddenOnly = (strings: string[]) => [...new Set(strings)].filter((s) => forbidden.has(s));
  return {
    shown: new Set(shownRoots.map(projectKey)),
    names: new Map(shownRoots.map((root) => [projectKey(root), names.get(root)!])),
    hidden: hiddenOnly(hiddenRoots.map(folderName)),
    branches: hiddenOnly(hiddenRoots.flatMap((root) => branches.get(root) ?? [])),
  };
}

/**
 * A text as showing mode lets it out: its paths trimmed (trimPaths), each session ID, bare or as `<uuid>.jsonl`,
 * written "a session", and each whole-word hidden branch and project name, in any case, written "another branch" and
 * "another project". A word holds letters, digits and `_`, so `-` ends one, as in a transcript folder's
 * `-Users-me-Work-<name>`.
 */
export function maskText(scope: Scope, text: string): string {
  let masked = trimPaths(text).replace(SESSION_IDS, 'a session');
  const masks: [string[], string][] = [
    [scope.branches, 'another branch'],
    [scope.hidden, 'another project'],
  ];
  for (const [words, mask] of masks) {
    for (const word of words) {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      masked = masked.replace(new RegExp(`(?<!\\w)${escaped}(?!\\w)`, 'gi'), mask);
    }
  }
  return masked;
}

/** A run's facts as a view shows them: with a scope, null for a hidden project's run, else named by the scope. */
export function showFacts(scope: Scope | null, facts: RunFacts): RunFacts | null {
  if (!scope) return facts;
  return scope.shown.has(facts.projectKey) ? { ...facts, project: scope.names.get(facts.projectKey)! } : null;
}

/** A warning as a view shows it: with a scope, its masked text and no session ID; else split by splitSessionId. */
export function showWarning(scope: Scope | null, text: string): { text: string; sessionId: string | null } {
  return scope ? { text: maskText(scope, text), sessionId: null } : splitSessionId(text);
}

/** The forbidden strings found in the JSON: the leak check of the views' tests and check:real. */
export function leaks(json: unknown, forbidden: string[]): string[] {
  const text = JSON.stringify(json);
  return forbidden.filter((s) => text.includes(s));
}

/**
 * What no showing-mode response may hold: the hidden roots, their folder names and their branches (by root), minus
 * any string a shown root or a shown run also has, plus the session IDs.
 */
export function forbiddenStrings(
  roots: string[],
  branches: Map<string, string[]>,
  shownRoots: string[],
  sessionIds: string[],
): string[] {
  const strings = (root: string) => [root, folderName(root), ...(branches.get(root) ?? [])];
  const shown = new Set(shownRoots.flatMap(strings));
  const hidden = roots.filter((root) => !shownRoots.includes(root)).flatMap(strings);
  return [...new Set([...hidden.filter((s) => s && !shown.has(s)), ...sessionIds])];
}
