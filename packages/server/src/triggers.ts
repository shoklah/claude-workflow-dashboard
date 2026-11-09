import { readdirSync, statSync, watch, type FSWatcher } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { Config } from './config.ts';

const TRANSCRIPT_CHECK_MS = 15 * 60 * 1000;

/** Whether a `.jsonl` file under `dir` changed after `since`; false when the folder is missing. */
function transcriptChangedSince(dir: string, since: Date | null): boolean {
  let entries;
  try {
    entries = readdirSync(dir, { recursive: true, withFileTypes: true });
  } catch {
    return false;
  }
  return entries.some((entry) => {
    if (!entry.isFile() || !entry.name.endsWith('.jsonl')) return false;
    // A file removed since the listing has no stat and counts as unchanged.
    const mtime = statSync(join(entry.parentPath, entry.name), { throwIfNoEntry: false })?.mtimeMs;
    return mtime !== undefined && (since === null || mtime > since.getTime());
  });
}

/**
 * Requests an import when the run log changes (a watch on its folder, filtered to its name, so a replaced file still
 * counts) and, every 15 minutes, when a transcript under `projectsDir` changed after the last import. A missing
 * folder means no watch, never a throw.
 */
export function startTriggers(config: Config, request: () => void, lastImportAt: () => Date | null): { stop(): void } {
  const name = basename(config.runLog);
  let watcher: FSWatcher | undefined;
  try {
    watcher = watch(dirname(config.runLog), (_event, file) => {
      if (file === name) request();
    });
    watcher.on('error', () => watcher?.close());
  } catch {
    watcher = undefined;
  }
  const timer = setInterval(() => {
    if (transcriptChangedSince(config.projectsDir, lastImportAt())) request();
  }, TRANSCRIPT_CHECK_MS);
  return {
    stop() {
      watcher?.close();
      clearInterval(timer);
    },
  };
}
