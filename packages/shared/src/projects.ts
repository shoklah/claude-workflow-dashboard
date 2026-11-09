// A worktree's folder under its project's root, as Claude Code makes it.
const WORKTREE = /\/\.claude\/worktrees\/[^/]+$/;

/** A project's root: the record's project with any trailing `/` and any trailing `/.claude/worktrees/<name>` removed. */
export function projectRoot(path: string): string {
  return path.replace(/\/+$/, '').replace(WORKTREE, '');
}

/** Each root's display name: its folder name, with ` (<parent folder>)` appended where two roots share it. */
export function projectNames(roots: string[]): Map<string, string> {
  const unique = [...new Set(roots)];
  const folder = (root: string) => root.split('/').filter(Boolean).at(-1) ?? '';
  const parent = (root: string) => root.split('/').filter(Boolean).at(-2) ?? '';
  const count = new Map<string, number>();
  for (const root of unique) count.set(folder(root), (count.get(folder(root)) ?? 0) + 1);
  return new Map(
    unique.map((root) => [root, count.get(folder(root))! > 1 ? `${folder(root)} (${parent(root)})` : folder(root)]),
  );
}
