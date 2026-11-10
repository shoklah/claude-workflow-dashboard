// A worktree's folder under its project's root, as Claude Code makes it.
const WORKTREE = /\/\.claude\/worktrees\/[^/]+$/;

/** A project's root: the record's project with any trailing `/` and any trailing `/.claude/worktrees/<name>` removed. */
export function projectRoot(path: string): string {
  return path.replace(/\/+$/, '').replace(WORKTREE, '');
}

/** A root's folder name. */
export function folderName(root: string): string {
  return root.split('/').filter(Boolean).at(-1) ?? '';
}

/** Each root's display name: its alias, else its folder name, with ` (<parent folder>)` appended where two roots
 * share it. */
export function projectNames(roots: string[], aliases: Record<string, string> = {}): Map<string, string> {
  const unique = [...new Set(roots)];
  const name = (root: string) => aliases[root] ?? folderName(root);
  const parent = (root: string) => root.split('/').filter(Boolean).at(-2) ?? '';
  const count = new Map<string, number>();
  for (const root of unique) count.set(name(root), (count.get(name(root)) ?? 0) + 1);
  return new Map(
    unique.map((root) => [root, count.get(name(root))! > 1 ? `${name(root)} (${parent(root)})` : name(root)]),
  );
}
