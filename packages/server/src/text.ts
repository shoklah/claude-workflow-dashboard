// The folders of an absolute path: from a `/` that starts a word up to its last `/`. A folder name may hold a space,
// but not a space before a `/`, which starts the next path; quotes, `:` and `;` end the path. Text after a path
// that holds a space and then a `/` reads as more folders and is cut too: more is cut, never less.
const PATH_FOLDERS = /(?<![\w.-])\/(?:(?:[^/'"\n:; ]| (?!\/))*\/)+/g;

/** The text with every absolute path cut to its last segment, so the banner names the command and no path leaves. */
export function trimPaths(text: string): string {
  return text.replace(PATH_FOLDERS, '');
}
