import { folderName, projectNames, SESSION_FILE, splitSessionId, type RunFacts } from '@cwd/shared';
import { projectKey } from '../keys.ts';
import { trimPaths } from '../text.ts';

/**
 * Showing mode's scope: the shown project keys, each one's display name (its alias, else its folder name), and the
 * hidden projects' folder names, minus any a shown project also has, since those reveal nothing.
 */
export type Scope = { shown: Set<string>; names: Map<string, string>; hidden: string[] };

const SESSION_FILES = new RegExp(SESSION_FILE.source, 'gi');

/** The scope of showing mode's picked keys over the stored runs' roots, or null while showing mode is off. */
export function scopeOf(showing: string[] | null, roots: string[], aliases: Record<string, string>): Scope | null {
  if (showing === null) return null;
  const unique = [...new Set(roots)];
  const isShown = (root: string) => showing.includes(projectKey(root));
  const shownRoots = unique.filter(isShown);
  const names = projectNames(shownRoots, aliases);
  const shownFolders = new Set(shownRoots.map(folderName));
  const hidden = unique.filter((root) => !isShown(root)).map(folderName);
  return {
    shown: new Set(shownRoots.map(projectKey)),
    names: new Map(shownRoots.map((root) => [projectKey(root), names.get(root)!])),
    hidden: [...new Set(hidden)].filter((name) => name && !shownFolders.has(name)),
  };
}

/**
 * A text as showing mode lets it out: its paths trimmed (trimPaths), each `<uuid>.jsonl` written "a session", and each
 * whole-word hidden project name, in any case, written "another project". A word holds letters, digits, `_` and `-`.
 */
export function maskText(scope: Scope, text: string): string {
  let masked = trimPaths(text).replace(SESSION_FILES, 'a session');
  for (const name of scope.hidden) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    masked = masked.replace(new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, 'gi'), 'another project');
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
