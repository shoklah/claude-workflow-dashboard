import { AREAS, type Area } from '@cwd/shared';
import type { Db } from './db/open.ts';
import { lastGoodImport } from './db/read.ts';

/** A category of the active list: its stable id, its display label and what it means, for the labeller's prompt. */
export type ListCategory = { id: string; label: string; means: string };

/**
 * The finding category list the app labels under: the workflow's, from the last good import. Its number is what a
 * label's `list_version` stores, 100 + the workflow's version, so it never meets the app's own list 1.
 */
export type ActiveList = {
  number: number;
  areas: Record<Area, ListCategory[]>;
  rule: string;
  validity: Record<string, string>;
};

/**
 * The active list, or null when the last good import's export had no category list (or no version), and then nothing
 * is labelled. An area the export doesn't list has no categories; a category with no label shows as its id.
 */
export function activeList(db: Db): ActiveList | null {
  const list = lastGoodImport(db)?.categories;
  if (list?.version == null) return null;
  const areas = Object.fromEntries(
    AREAS.map((area) => [
      area,
      (list.areas?.find((a) => a.area === area)?.list ?? []).map(({ id, label, means }) => ({
        id,
        label: label ?? id,
        means: means ?? '',
      })),
    ]),
  ) as Record<Area, ListCategory[]>;
  return { number: 100 + list.version, areas, rule: list.rule ?? '', validity: list.validity ?? {} };
}

/** Each category's display label by its id, as responses carry them; none with no active list. */
export function categoryLabels(list: ActiveList | null): Record<string, string> {
  return Object.fromEntries(AREAS.flatMap((area) => list?.areas[area].map((c) => [c.id, c.label]) ?? []));
}
