import type { FindingRow, Outcome, StrengthRow, TimelineGroup, TimelineStep } from '@cwd/shared';
import { STEP_LABELS, outcomeLabel } from '../lib/format.ts';

/** One review with its fix rounds: a box of the graph. */
export type Unit = {
  id: string;
  name: string;
  task: number | null;
  wave: string | null;
  kit: boolean;
  review: TimelineStep | null;
  rounds: TimelineStep[];
  findings: FindingRow[];
};
export type Stage = { kind: TimelineGroup['kind']; at: string | null; parallel: Unit[]; then: Unit[]; conflicts: number };

const isRound = (s: TimelineStep) => s.step === 'fix_check' || s.step === 'final_fix_check';
/** A kit's own step, as the server's `timeline` tells them apart. */
const isKit = (s: TimelineStep) => s.step === 'kit_review' || s.kit != null;

function unitOf(id: string, name: string, steps: TimelineStep[], where: Pick<Unit, 'task' | 'wave' | 'kit'>): Unit {
  return {
    id,
    name,
    ...where,
    review: steps.find((s) => !isRound(s)) ?? null,
    rounds: steps.filter(isRound),
    findings: steps.flatMap((s) => s.findings),
  };
}

/** A task's units: its review, and beside it its kit's review when it has one. */
function taskUnits({ task, steps }: { task: number; steps: TimelineStep[] }, wave: string | null): Unit[] {
  const kit = steps.filter(isKit);
  return [
    unitOf(`t${task}`, `Task ${task}`, steps.filter((s) => !isKit(s)), { task, wave, kit: false }),
    ...(kit.length ? [unitOf(`k${task}`, `Task ${task} kit review`, kit, { task, wave, kit: true })] : []),
  ];
}

/** The timeline's groups as stages of units: a wave's tasks (a kit-reviewed task's two boxes together) side by side,
 * then its check; a task with a kit review, or the final review with a task-less one, side by side. */
export function stagesOf(timeline: TimelineGroup[]): Stage[] {
  return timeline.map((g) => {
    const stage = (parallel: Unit[], then: Unit[]): Stage => ({ kind: g.kind, at: g.at, parallel, then, conflicts: g.conflicts ?? 0 });
    const side = (units: Unit[]) => (units.length > 1 ? stage(units, []) : stage([], units));
    switch (g.kind) {
      case 'wave': {
        const wave = g.label.replace(/^Wave /, '');
        const check = g.steps.length ? [unitOf(`w${wave}`, `${g.label} check`, g.steps, { task: null, wave, kit: false })] : [];
        return stage(g.tasks.flatMap((t) => taskUnits(t, wave)), check);
      }
      case 'task':
        return side(g.tasks.flatMap((t) => taskUnits(t, null)));
      case 'plan':
        return stage([], g.steps.map((s) => unitOf(s.step, STEP_LABELS[s.step], [s], { task: null, wave: null, kit: false })));
      case 'simplify':
        return stage([], g.steps.length ? [unitOf('simplify', STEP_LABELS.simplify, g.steps, { task: null, wave: null, kit: false })] : []);
      case 'final': {
        const main = g.steps.filter((s) => !isKit(s));
        const kit = g.steps.filter(isKit);
        return side([
          ...(main.length ? [unitOf('final', 'Final review', main, { task: null, wave: null, kit: false })] : []),
          ...(kit.length ? [unitOf('kit', 'Kit review', kit, { task: null, wave: null, kit: true })] : []),
        ]);
      }
      default:
        return stage([], []);
    }
  });
}

/** Every unit, in drawing order. */
export function unitsOf(stages: Stage[]): Unit[] {
  return stages.flatMap((s) => [...s.parallel, ...s.then]);
}

const LEFT = ['deferred', 'to_owner', 'open', 'declined', 'ruled', 'none'] as const;

/** A unit's findings that were not fixed or applied, by outcome (`none`: no outcome), the non-zero counts only. */
export function leftOf(unit: Unit): [Outcome | 'none', number][] {
  return LEFT.flatMap((key) => {
    const n = unit.findings.filter((f) => (f.outcome ?? 'none') === key).length;
    return n ? [[key, n] as [Outcome | 'none', number]] : [];
  });
}

/** Its last round left a finding open or "fixed, not proportionate", which the workflow counts as open. */
export function stuck(unit: Unit): boolean {
  const last = unit.rounds.at(-1);
  return !!last && ((last.counts.open ?? 0) > 0 || (last.counts.not_proportionate ?? 0) > 0);
}

/** A unit's strengths: its review's kind, task and wave (a task's by its task, a wave check's by its wave); a kit
 * review has none. */
export function strengthsOf(unit: Unit, strengths: StrengthRow[]): StrengthRow[] {
  const review = unit.review;
  if (!review || unit.kit) return [];
  return strengths.filter(
    (s) => s.step === review.step && (unit.task != null ? s.task === unit.task : s.task == null && s.wave === unit.wave),
  );
}

export type Shape = 'flat' | 'wrapped' | 'upright';
type Rect = { x: number; y: number; w: number; h: number; row: number };
export type Placed = Rect &
  (
    | { kind: 'unit'; unit: Unit }
    | { kind: 'pill'; end: 'start' | 'end'; at: string | null }
    | { kind: 'conflicts'; count: number }
    | { kind: 'chip'; unit: Unit; outcome: Outcome | 'none'; count: number }
    | { kind: 'arc'; unit: Unit }
  ); // the loop's label, over its box
/** `lead`: a straight run before the curve. `fade`: a straight run to or from the panel's side. */
export type Anchor = { x: number; y: number; lead?: number };
export type Edge = { from: Anchor; to: Anchor; fade?: 'out' | 'in'; head: boolean };
export type Layout = { shape: Shape; width: number; height: number; rows: number; placed: Placed[]; edges: Edge[] };

/** A box. */
const W = 128;
const H = 68;
/** Between ranks lying down, between a rank's stacked boxes, between ranks standing up, between boxes side by side. */
const GX = 22;
const GY = 12;
const GV = 26;
const GH = 8;
/** The band over a box for its loop, and each exit chip's line under it. */
const LOOP = 42;
const EXIT = 24;
const PILL = 118;
const PILL_H = 44;
/** The narrowest a pill gets: "Record written" at the small size, and its padding. */
const PILL_NARROW = 110;
/** The conflicts' rank, and its label's height. */
const MERGE = 84;
const MERGE_H = 24;
const LABEL_H = 18;
/** The widest the upright graph grows. */
const TALL = 420;
/** Wrapped: the room at a row's two ends for its fades, and between rows. */
const SIDE = 48;
const GR = 30;
/** Standing up: the margin a rank of several lines keeps on each side for the edges that pass its lines. */
const MARGIN = 16;
/** Where an arc's label and a chip start from a box's left side, and where an upright edge leaves beside them. */
const ARC_IN = 16;
const CHIP_IN = 22;
const SIDE_IN = 10;
/** Text's estimated width: 6 px a character, a chip's padding, and a box's padding with its border. */
const CHAR = 6;
const CHIP_PAD = 12;
const BOX_PAD = 22;
/** Most boxes on one upright line. */
const LINE = 3;

/** The narrowest panel that wraps: four boxes with their gaps, and the fades' room at both ends. */
export const WRAP_MIN = 2 * SIDE + 4 * W + 3 * GX;

/** A rank: a pill, a merge carrying a wave's conflicts, or units side by side. */
type Rank = { units: Unit[]; pill?: Stage; merge?: number };
type In = { at: Anchor; head: boolean };
type Layer = { ins: In[]; outs: Anchor[] };

/** The run's ranks, in order: a wave's tasks share one rank, since they ran side by side. */
function ranksOf(stages: Stage[]): Rank[] {
  return stages.flatMap((s): Rank[] =>
    s.kind === 'start' || s.kind === 'end'
      ? [{ units: [], pill: s }]
      : [
          ...(s.parallel.length ? [{ units: s.parallel }] : []),
          ...(s.conflicts ? [{ units: [], merge: s.conflicts }] : []),
          ...s.then.map((u) => ({ units: [u] })),
        ],
  );
}

const joined = (layers: Layer[]): Edge[] =>
  layers.slice(1).flatMap((layer, i) => layers[i].outs.flatMap((from) => layer.ins.map(({ at, head }) => ({ from, to: at, head }))));

const chipWidth = (outcome: Outcome | 'none', count: number) => `${outcomeLabel(outcome)} ${count}`.length * CHAR + CHIP_PAD;

/** The narrowest a box can be with its name, its reviewer and its exit chips whole, by the text estimate. */
export function boxNeed(unit: Unit): number {
  const text = [unit.name, unit.review?.agent ?? 'in the session'].map((t) => t.length * CHAR + BOX_PAD);
  const chips = leftOf(unit).map(([outcome, count]) => chipWidth(outcome, count) + CHIP_IN + SIDE_IN + 4);
  return Math.max(...text, ...chips);
}

const blockHeight = (u: Unit) => LOOP + H + leftOf(u).length * EXIT;
const rankHeight = (r: Rank) =>
  r.merge ? MERGE_H : r.pill ? PILL_H : r.units.reduce((sum, u) => sum + blockHeight(u), 0) + (r.units.length - 1) * GY;
const rankWidth = (r: Rank, w = W, p = PILL) => (r.merge ? MERGE : r.pill ? p : w);
const pillOf = (s: Stage, x: number, y: number, row: number, p = PILL): Placed => ({
  kind: 'pill',
  end: s.kind === 'start' ? 'start' : 'end',
  at: s.at,
  x,
  y,
  w: p,
  h: PILL_H,
  row,
});
const conflictsOf = (count: number, x: number, y: number, row: number): Placed => ({
  kind: 'conflicts',
  count,
  x,
  y,
  w: MERGE,
  h: LABEL_H,
  row,
});

/** A unit's box with its loop's label over it and its exit chips under it, each chip no wider than the box allows. */
function block(unit: Unit, x: number, top: number, w: number, row: number): Placed[] {
  return [
    ...(unit.rounds.length ? [{ kind: 'arc', unit, x: x + ARC_IN, y: top - LOOP, w: w - ARC_IN, h: LOOP, row } as const] : []),
    { kind: 'unit', unit, x, y: top, w, h: H, row },
    ...leftOf(unit).map(([outcome, count], i): Placed => ({
      kind: 'chip',
      unit,
      outcome,
      count,
      x: x + CHIP_IN,
      y: top + H + i * EXIT + 4,
      w: Math.min(chipWidth(outcome, count), w - CHIP_IN - SIDE_IN - 4),
      h: EXIT - 4,
      row,
    })),
  ];
}

/** One row of ranks from (x0, y0), left to right, a rank's units stacked, every rank centred on the row's height; its
 * boxes `w` wide and its pills `p`. */
function row(ranks: Rank[], x0: number, y0: number, index: number, w = W, p = PILL) {
  const height = Math.max(...ranks.map(rankHeight), PILL_H);
  const width = ranks.reduce((sum, r) => sum + rankWidth(r, w, p), 0) + (ranks.length - 1) * GX;
  const mid = y0 + height / 2;
  const placed: Placed[] = [];
  const layers: Layer[] = [];
  const edges: Edge[] = [];
  let x = x0;
  for (const r of ranks) {
    let y = y0 + (height - rankHeight(r)) / 2;
    if (r.merge) {
      const from = { x, y: mid };
      const to = { x: x + MERGE, y: mid };
      placed.push(conflictsOf(r.merge, x, mid - LABEL_H - 4, index));
      layers.push({ ins: [{ at: from, head: false }], outs: [to] });
      edges.push({ from, to, head: false });
    } else if (r.pill) {
      placed.push(pillOf(r.pill, x, y, index, p));
      layers.push({ ins: [{ at: { x, y: y + PILL_H / 2 }, head: true }], outs: [{ x: x + p, y: y + PILL_H / 2 }] });
    } else {
      const layer: Layer = { ins: [], outs: [] };
      for (const u of r.units) {
        const top = y + LOOP;
        placed.push(...block(u, x, top, w, index));
        layer.ins.push({ at: { x, y: top + H / 2 }, head: true });
        layer.outs.push({ x: x + w, y: top + H / 2 });
        y += blockHeight(u) + GY;
      }
      layers.push(layer);
    }
    x += rankWidth(r, w, p) + GX;
  }
  return { placed, layers, edges, width, height, mid };
}

/** Lying flat: one row, its boxes `w` wide and its pills `p`. */
function flat(ranks: Rank[], w = W, p = PILL): Layout {
  const { placed, layers, edges, width, height } = row(ranks, 0, 0, 0, w, p);
  return { shape: 'flat', width, height, rows: 1, placed, edges: [...joined(layers), ...edges] };
}

/** Ranks in rows of at most `limit` wide, a merge never starting a row, so a wave's conflicts stay on its row. */
function fill(ranks: Rank[], limit: number): Rank[][] {
  const groups: Rank[][] = [];
  for (const r of ranks) {
    if (r.merge && groups.length) groups.at(-1)!.push(r);
    else groups.push([r]);
  }
  const widthOf = (g: Rank[]) => g.reduce((sum, r) => sum + rankWidth(r) + GX, 0);
  const rows: Rank[][] = [[]];
  let used = -GX;
  for (const g of groups) {
    if (used + widthOf(g) > limit && rows.at(-1)!.length) {
      rows.push([]);
      used = -GX;
    }
    rows.at(-1)!.push(...g);
    used += widthOf(g);
  }
  return rows;
}

/** Wrapped: the fewest rows that fit `avail`, then the narrowest rows that keep that count, so the last isn't a
 * stub. A row's last edge runs to the panel's side and fades out, and fades back in at the left of the next row. */
function wrapped(ranks: Rank[], avail: number): Layout {
  let rows = fill(ranks, avail - 2 * SIDE);
  for (let limit = avail - 2 * SIDE - 1; limit > 0; limit--) {
    const tighter = fill(ranks, limit);
    if (tighter.length > rows.length) break;
    rows = tighter;
  }
  const placed: Placed[] = [];
  const edges: Edge[] = [];
  let y = 0;
  let last: { outs: Anchor[]; mid: number; end: number } | null = null;
  rows.forEach((ranksOfRow, i) => {
    const laid = row(ranksOfRow, SIDE, y, i);
    placed.push(...laid.placed);
    edges.push(...joined(laid.layers), ...laid.edges);
    if (last) {
      const out = { x: last.end + SIDE / 2, y: last.mid };
      const back = { x: SIDE / 2, y: laid.mid };
      edges.push(...last.outs.map((from) => ({ from, to: out, head: false })));
      edges.push({ from: out, to: { x: avail, y: last.mid }, fade: 'out', head: false });
      edges.push({ from: { x: 0, y: laid.mid }, to: back, fade: 'in', head: false });
      edges.push(...laid.layers[0].ins.map(({ at, head }) => ({ from: back, to: at, head })));
    }
    last = { outs: laid.layers.at(-1)!.outs, mid: laid.mid, end: SIDE + laid.width };
    y += laid.height + GR;
  });
  return { shape: 'wrapped', width: avail, height: y - GR, rows: rows.length, placed, edges };
}

/** A rank's units in lines of at most three, a task never apart from its kit review. */
function linesOf(units: Unit[]): Unit[][] {
  const groups: Unit[][] = [];
  for (const u of units) {
    const prev = groups.at(-1);
    if (u.kit && prev && prev[0].task === u.task) prev.push(u);
    else groups.push([u]);
  }
  const lines: Unit[][] = [];
  for (const g of groups) {
    const line = lines.at(-1);
    if (line && line.length + g.length <= LINE) line.push(...g);
    else lines.push([...g]);
  }
  return lines;
}

/** Standing up: ranks top to bottom, a rank's units side by side, narrowed to fit `avail`. An edge comes in straight
 * beside a loop's label and leaves straight beside the exit chips, down to its line's bottom, so it curves only in the
 * gaps between lines. A rank of several lines keeps a margin on each side: the edges to its later lines run down the
 * left one, those from its earlier lines down the right one. */
function upright(ranks: Rank[], avail: number): Layout {
  const width = Math.min(avail, TALL);
  const placed: Placed[] = [];
  const layers: Layer[] = [];
  const edges: Edge[] = [];
  let y = 0;
  for (const r of ranks) {
    if (r.merge) {
      const from = { x: width / 2, y };
      const to = { x: width / 2, y: y + MERGE_H };
      placed.push(conflictsOf(r.merge, width / 2 + SIDE_IN, y + (MERGE_H - LABEL_H) / 2, 0));
      layers.push({ ins: [{ at: from, head: false }], outs: [to] });
      edges.push({ from, to, head: false });
      y += MERGE_H + GV;
      continue;
    }
    if (r.pill) {
      placed.push(pillOf(r.pill, (width - PILL) / 2, y, 0));
      layers.push({ ins: [{ at: { x: width / 2, y }, head: true }], outs: [{ x: width / 2, y: y + PILL_H }] });
      y += PILL_H + GV;
      continue;
    }
    const lines = linesOf(r.units);
    const margin = lines.length > 1 ? MARGIN : 0;
    const n = Math.max(...lines.map((l) => l.length));
    const w = Math.min(W, Math.floor((width - 2 * margin - (n - 1) * GH) / n));
    const [left, right] = [margin / 2, width - margin / 2];
    const layer: Layer = { ins: [], outs: [] };
    let passing: Anchor | null = null;
    lines.forEach((line, i) => {
      const bottom = y + Math.max(...line.map(blockHeight));
      const ins: In[] = [];
      const outs: Anchor[] = [];
      let x = (width - (line.length * w + (line.length - 1) * GH)) / 2;
      for (const u of line) {
        const top = y + LOOP;
        placed.push(...block(u, x, top, w, 0));
        const exits = leftOf(u).length > 0;
        ins.push({ at: { x: u.rounds.length ? x + SIDE_IN : x + w / 2, y: top, lead: LOOP }, head: true });
        outs.push({ x: exits ? x + w - SIDE_IN : x + w / 2, y: top + H, lead: bottom - top - H });
        x += w + GH;
      }
      if (i === 0) layer.ins.push(...ins);
      else {
        // From the left margin's run past the lines above, into this line, and on down to the next line.
        const from = { x: left, y: y - GV };
        edges.push(...ins.map(({ at, head }) => ({ from, to: at, head })));
      }
      if (i < lines.length - 1) {
        // The left margin's run past this line, and this line's outs to the right margin's run past the next one.
        const down = { x: left, y: bottom, lead: bottom - y };
        if (i === 0) layer.ins.push({ at: down, head: false });
        else edges.push({ from: { x: left, y: y - GV }, to: down, head: false });
        const next = bottom + GV;
        const nextBottom = next + Math.max(...lines[i + 1].map(blockHeight));
        const past = { x: right, y: nextBottom, lead: nextBottom - next };
        edges.push(...outs.map((from) => ({ from, to: past, head: false })));
        if (passing) edges.push({ from: passing, to: past, head: false });
        passing = { x: right, y: nextBottom };
      } else {
        layer.outs.push(...outs, ...(passing ? [passing] : []));
      }
      y = bottom + GV;
    });
    layers.push(layer);
  }
  return { shape: 'upright', width, height: y - GV, rows: 1, placed, edges: [...joined(layers), ...edges] };
}

/** The run's graph by the panel's width: flat when it fits (or before the panel is measured), wrapped when four boxes
 * fit a row, below that flat with narrower pills, then narrower boxes, while every box keeps its `boxNeed`, else
 * upright, so it never scrolls sideways. */
export function layout(stages: Stage[], avail: number | null): Layout {
  const ranks = ranksOf(stages);
  const lying = flat(ranks);
  if (avail === null || lying.width <= avail) return lying;
  if (avail >= WRAP_MIN) return wrapped(ranks, avail);
  // Too narrow to wrap: a short graph still lies flat, its pills giving up width first, down to their text's.
  const pills = ranks.filter((r) => r.pill).length;
  const p = pills ? Math.max(PILL_NARROW, PILL - Math.ceil((lying.width - avail) / pills)) : PILL;
  const thinner = flat(ranks, W, p);
  if (thinner.width <= avail) return thinner;
  // Then its boxes, down to the widest box's need.
  const units = ranks.flatMap((r) => r.units);
  const boxes = ranks.filter((r) => r.units.length).length;
  const w = Math.floor((avail - (thinner.width - boxes * W)) / boxes);
  return units.every((u) => boxNeed(u) <= w) ? flat(ranks, w, p) : upright(ranks, avail);
}
