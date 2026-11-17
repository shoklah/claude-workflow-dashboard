import { describe, expect, it } from 'vitest';
import type { StrengthRow, TimelineGroup, TimelineStep } from '@cwd/shared';
import { runBeforeSteps, runFull, runLong, runPlan, runSmall, runStopped } from '../test/runs.ts';
import { WRAP_MIN, boxNeed, layout, leftOf, stagesOf, strengthsOf, stuck, unitsOf, type Layout, type Placed, type Unit } from './flow.ts';

type Rect = { x: number; y: number; w: number; h: number; row: number };

const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** No two placed things overlap, and no edge passes over one: each edge is its two straight leads and the box
 * its curve lies in between them (a fading edge, with no lead, is the one straight run). A conflicts label sits
 * on its own edge, so it is left out of the edge check. */
function clear({ placed, edges, shape }: Layout): boolean {
  const apart = placed.every((a, i) => placed.slice(i + 1).every((b) => !hit(a, b)));
  const others = placed.filter((p) => p.kind !== 'conflicts');
  const free = edges.every(({ from, to }) => {
    const [a, b] = [from.lead ?? 0, to.lead ?? 0];
    const parts: Rect[] = shape === 'upright'
      ? [{ x: from.x, w: 0, y: from.y, h: a, row: 0 }, { x: to.x, w: 0, y: to.y - b, h: b, row: 0 },
         { x: Math.min(from.x, to.x), w: Math.abs(to.x - from.x), y: from.y + a, h: to.y - b - from.y - a, row: 0 }]
      : [{ x: from.x, w: a, y: from.y, h: 0, row: 0 }, { x: to.x - b, w: b, y: to.y, h: 0, row: 0 },
         { x: from.x + a, w: to.x - b - from.x - a, y: Math.min(from.y, to.y), h: Math.abs(to.y - from.y), row: 0 }];
    return parts.every((part) => others.every((p) => !hit(part, p)));
  });
  return apart && free;
}

const ids = (units: Unit[]) => units.map((u) => u.id);
const unitOf = (timeline: TimelineGroup[], id: string) => unitsOf(stagesOf(timeline)).find((u) => u.id === id)!;
const step = (s: Partial<TimelineStep> & Pick<TimelineStep, 'step'>): TimelineStep => ({
  round: 0, agent: null, model: null, effort: null, kit: null, counts: {}, findings: [], ...s,
});
const group = (g: Partial<TimelineGroup> & Pick<TimelineGroup, 'kind'>): TimelineGroup => ({
  label: '', at: null, conflicts: null, tasks: [], steps: [], ...g,
});
const STORIES = { runFull, runBeforeSteps, runLong, runStopped, runSmall, runPlan };

describe('stagesOf', () => {
  it("gives the full run's units in drawing order", () => {
    expect(ids(unitsOf(stagesOf(runFull.timeline)))).toEqual(['t1', 't2', 'wA', 't3', 't4', 'simplify', 'final']);
  });

  it("puts a task's kit review beside it", () => {
    const stage = stagesOf(runLong.timeline).find((s) => s.parallel.some((u) => u.id === 't7'))!;
    expect(ids(stage.parallel)).toEqual(['t7', 'k7']);
    expect(stage.parallel.map((u) => u.name)).toEqual(['Task 7', 'Task 7 kit review']);
    expect(stage.parallel.map((u) => u.kit)).toEqual([false, true]);
  });

  it('puts a task-less kit review beside the final review', () => {
    const [stage] = stagesOf([group({ kind: 'final', steps: [step({ step: 'final_review' }), step({ step: 'kit_review', kit: 'ui' })] })]);
    expect(ids(stage.parallel)).toEqual(['final', 'kit']);
    expect(stage.parallel.map((u) => u.name)).toEqual(['Final review', 'Kit review']);
    expect(stage.then).toEqual([]);
  });

  it("draws a plan run's two steps as two units in a row", () => {
    const plan = stagesOf(runPlan.timeline).find((s) => s.kind === 'plan')!;
    expect(plan.parallel).toEqual([]);
    expect(ids(plan.then)).toEqual(['plan_simplify', 'plan_review']);
    expect(plan.then.map((u) => u.name)).toEqual(['Plan simplify', 'Plan review']);
  });

  it("gives a task's kit review step with no kit its own unit", () => {
    const [stage] = stagesOf([group({ kind: 'task', tasks: [{ task: 3, steps: [step({ step: 'task_review' }), step({ step: 'kit_review' })] }] })]);
    expect(ids(stage.parallel)).toEqual(['t3', 'k3']);
  });

  it("names a wave's check and carries its conflicts", () => {
    const stages = stagesOf(runLong.timeline);
    const waveB = stages.find((s) => s.kind === 'wave' && s.then.some((u) => u.id === 'wB'))!;
    expect(waveB.then.map((u) => [u.name, u.wave])).toEqual([['Wave B check', 'B']]);
    expect(waveB.conflicts).toBe(2);
    expect(stages.find((s) => s.kind === 'task')!.conflicts).toBe(0);
  });

  it.each(Object.entries(STORIES))('puts every step of %s in exactly one unit', (_, run) => {
    const steps = run.timeline.flatMap((g) => [...g.tasks.flatMap((t) => t.steps), ...g.steps]);
    const placed = unitsOf(stagesOf(run.timeline)).flatMap((u) => [...(u.review ? [u.review] : []), ...u.rounds]);
    expect(placed).toHaveLength(steps.length);
    expect(new Set(placed)).toEqual(new Set(steps));
  });
});

describe('leftOf and stuck', () => {
  it("gives the full run's wave check its ruled finding, and a stuck loop", () => {
    const wA = unitOf(runFull.timeline, 'wA');
    expect(leftOf(wA)).toEqual([['ruled', 1]]);
    expect(stuck(wA)).toBe(true);
  });

  it('leaves nothing for fixed and applied findings', () => {
    const unit = unitOf(runFull.timeline, 'simplify');
    expect(leftOf(unit)).toEqual([]);
    expect(leftOf(unitOf(runLong.timeline, 't2'))).toEqual([]);
    expect(stuck(unitOf(runLong.timeline, 't2'))).toBe(false);
  });

  it('orders what is left and counts a finding with no outcome', () => {
    const [stage] = stagesOf([
      group({
        kind: 'task',
        tasks: [{ task: 1, steps: [step({ step: 'task_review', findings: [null, 'ruled', 'open', 'deferred', 'open'].map((outcome) => ({ ...runFull.findings[0], outcome: outcome as never })) })] }],
      }),
    ]);
    expect(leftOf(stage.then[0])).toEqual([['deferred', 1], ['open', 2], ['ruled', 1], ['none', 1]]);
  });

  it('counts a last round that left a finding not proportionate as stuck', () => {
    expect(stuck(unitOf(runLong.timeline, 't9'))).toBe(true);
    expect(stuck(unitOf(runLong.timeline, 'wA'))).toBe(false);
  });
});

describe('boxNeed', () => {
  it("is the widest of a box's name, reviewer and exit chips, by the text estimate", () => {
    // "task-reviewer" (13 chars) is wider than "Wave A check" (12) and the chip "Ruled 1".
    expect(boxNeed(unitOf(runFull.timeline, 'wA'))).toBe(13 * 6 + 22);
    // The chip "Deferred 1" and its room beside the box: 10 chars, its padding, and its insets.
    const deferred = { ...unitOf(runFull.timeline, 't3'), findings: [{ ...runFull.findings[1] }] };
    expect(boxNeed(deferred)).toBe(10 * 6 + 12 + 36);
  });
});

describe('strengthsOf', () => {
  const strength = (s: Partial<StrengthRow>): StrengthRow => ({ step: 'task_review', task: null, wave: null, round: 0, category: null, summary: 'x', ...s });

  it("gives a task review's strength to its task only", () => {
    const s = strength({ task: 3 });
    const units = unitsOf(stagesOf(runFull.timeline));
    expect(units.filter((u) => strengthsOf(u, [s]).length > 0).map((u) => u.id)).toEqual(['t3']);
  });

  it("gives a wave's strength to its check", () => {
    const s = strength({ wave: 'A' });
    const units = unitsOf(stagesOf(runFull.timeline));
    expect(units.filter((u) => strengthsOf(u, [s]).length > 0).map((u) => u.id)).toEqual(['wA']);
  });

  it("gives the final review's strength to it, never to a kit review", () => {
    const s = strength({ step: 'final_review' });
    const units = unitsOf(stagesOf(runLong.timeline));
    expect(units.filter((u) => strengthsOf(u, [s]).length > 0).map((u) => u.id)).toEqual(['final']);
    expect(strengthsOf(unitOf(runLong.timeline, 'k7'), [strength({ task: 7 })])).toEqual([]);
  });
});

const AT = [343, 720, WRAP_MIN, 1100, 1392];
const rowsOf = ({ placed }: Layout) => {
  const rows: Placed[][] = [];
  for (const p of placed) (rows[p.row] ??= []).push(p);
  return rows;
};
const span = (row: Placed[]) => Math.max(...row.map((p) => p.x + p.w)) - Math.min(...row.map((p) => p.x));

describe('layout', () => {
  it.each(AT.flatMap((at) => [['runFull', at], ['runLong', at]] as const))('keeps %s clear at %i', (name, at) => {
    const result = layout(stagesOf(STORIES[name].timeline), at);
    expect(clear(result)).toBe(true);
    expect(result.placed.filter((p) => p.kind === 'unit')).toHaveLength(unitsOf(stagesOf(STORIES[name].timeline)).length);
  });

  it('places a chip under its box, no wider than it, and an arc over a box with rounds', () => {
    for (const at of AT) {
      const { placed } = layout(stagesOf(runLong.timeline), at);
      const boxes = new Map(placed.flatMap((p) => (p.kind === 'unit' ? [[p.unit.id, p] as const] : [])));
      const chips = placed.filter((p) => p.kind === 'chip');
      expect(chips.map((c) => (c.kind === 'chip' ? `${c.unit.id} ${c.outcome} ${c.count}` : ''))).toContain('t10 open 1');
      for (const chip of chips) {
        const box = boxes.get(chip.unit.id)!;
        expect(chip.y).toBeGreaterThanOrEqual(box.y + box.h);
        expect(chip.x).toBeGreaterThanOrEqual(box.x);
        expect(chip.x + chip.w).toBeLessThanOrEqual(box.x + box.w);
      }
      const arcs = placed.filter((p) => p.kind === 'arc').map((p) => (p.kind === 'arc' ? p.unit.id : ''));
      expect(arcs).toEqual(unitsOf(stagesOf(runLong.timeline)).filter((u) => u.rounds.length).map((u) => u.id));
    }
  });

  it.each(
    (['runPlan', 'runSmall', 'runFull', 'runLong'] as const).flatMap((name) => [504, 720, 343].map((at) => [name, at] as const)),
  )('gives every box of %s at %i the width its text needs', (name, at) => {
    const { placed } = layout(stagesOf(STORIES[name].timeline), at);
    for (const p of placed) if (p.kind === 'unit') expect(p.w, p.unit.name).toBeGreaterThanOrEqual(boxNeed(p.unit));
  });

  describe('flat', () => {
    it.each([['runSmall', 504], ['runSmall', 720], ['runSmall', 1392], ['runPlan', 720], ['runPlan', 1392]] as const)('lies %s flat at %i', (name, at) => {
      const result = layout(stagesOf(STORIES[name].timeline), at);
      expect(result.shape).toBe('flat');
      expect(result.rows).toBe(1);
      expect(result.edges.some((e) => e.fade)).toBe(false);
      expect(result.width).toBeLessThanOrEqual(at);
      expect(clear(result)).toBe(true);
    });

    it('lies the full run flat wherever it fits, as at 1392', () => {
      const result = layout(stagesOf(runFull.timeline), 1392);
      expect(result.shape).toBe('flat');
      expect(result.width).toBeLessThanOrEqual(1392);
    });

    it('lies flat before the panel is measured', () => {
      expect(layout(stagesOf(runLong.timeline), null).shape).toBe('flat');
    });

    it('draws the start and end pills with their times', () => {
      const pills = layout(stagesOf(runFull.timeline), null).placed.filter((p) => p.kind === 'pill');
      expect(pills.map((p) => (p.kind === 'pill' ? [p.end, p.at] : null))).toEqual([
        ['start', runFull.facts.startedAt],
        ['end', runFull.facts.finishedAt],
      ]);
    });

    it("carries a wave's conflicts as a label", () => {
      const labels = layout(stagesOf(runFull.timeline), null).placed.filter((p) => p.kind === 'conflicts');
      expect(labels.map((p) => (p.kind === 'conflicts' ? p.count : 0))).toEqual([1]);
    });
  });

  describe('wrapped', () => {
    // The full story run is 1114 wide lying flat, so it wraps from 1100 (the served fixture's run, with a Wave B check,
    // is wider and wraps at the 1440 px panel, as the captures show).
    const cases = [['runFull', 1100, 2], ['runLong', 1392, 2], ['runLong', 1100, null]] as const;
    it.each(cases)('wraps %s at %i in balanced rows', (name, at, rows) => {
      const result = layout(stagesOf(STORIES[name].timeline), at);
      expect(result.shape).toBe('wrapped');
      if (rows) expect(result.rows).toBe(rows);
      else expect(result.rows).toBeGreaterThanOrEqual(2);
      const byRow = rowsOf(result);
      expect(byRow).toHaveLength(result.rows);
      const outs = result.edges.filter((e) => e.fade === 'out');
      const ins = result.edges.filter((e) => e.fade === 'in');
      expect(outs).toHaveLength(result.rows - 1);
      expect(ins).toHaveLength(result.rows - 1);
      byRow.forEach((row, i) => {
        const top = Math.min(...row.map((p) => p.y));
        const bottom = Math.max(...row.map((p) => p.y + p.h));
        const inRow = (y: number) => y >= top && y <= bottom;
        expect(outs.filter((e) => inRow(e.from.y))).toHaveLength(i < byRow.length - 1 ? 1 : 0);
        expect(ins.filter((e) => inRow(e.to.y))).toHaveLength(i > 0 ? 1 : 0);
        const first = row.reduce((a, b) => (b.x < a.x ? b : a));
        expect(first.kind).not.toBe('conflicts');
      });
      expect(span(byRow.at(-1)!)).toBeGreaterThanOrEqual(0.6 * span(byRow[0]));
      expect(result.placed.every((p) => p.x >= 0 && p.x + p.w <= at)).toBe(true);
    });

    it('keeps every placed thing inside 1100', () => {
      for (const run of [runFull, runLong]) {
        expect(layout(stagesOf(run.timeline), 1100).placed.every((p) => p.x + p.w <= 1100)).toBe(true);
      }
    });

    it('wraps at the narrowest panel that holds four boxes', () => {
      expect(layout(stagesOf(runLong.timeline), WRAP_MIN).shape).toBe('wrapped');
    });
  });

  describe('upright', () => {
    // 454 is the graph's width at 768 px, beside the rail.
    it.each([343, 454, 504])("stands the plan run up at %i, where lying flat would cut its reviewer's name", (at) => {
      const result = layout(stagesOf(runPlan.timeline), at);
      expect(result.shape).toBe('upright');
      expect(clear(result)).toBe(true);
    });

    it.each([WRAP_MIN - 1, 343])('stands the long run up at %i', (at) => {
      const result = layout(stagesOf(runLong.timeline), at);
      expect(result.shape).toBe('upright');
      expect(result.width).toBeLessThanOrEqual(at);
      const boxes = new Map(result.placed.flatMap((p) => (p.kind === 'unit' ? [[p.unit.id, p] as const] : [])));
      expect(new Set(['t1', 't2', 't3'].map((id) => boxes.get(id)!.y)).size).toBe(1);
      expect(result.placed.every((p) => p.x >= 0 && p.x + p.w <= at)).toBe(true);
      expect(clear(result)).toBe(true);
    });

    it('stands a wave of three kit-reviewed tasks in lines of at most three, each task beside its kit review', () => {
      const tasks = [1, 2, 3].map((task) => ({ task, steps: [step({ step: 'task_review' }), step({ step: 'kit_review', kit: 'ui', findings: [{ ...runFull.findings[1], outcome: null }] })] }));
      const timeline = [runFull.timeline[0], group({ kind: 'wave', label: 'Wave A', tasks }), runFull.timeline.at(-1)!];
      const result = layout(stagesOf(timeline), 343);
      expect(result.shape).toBe('upright');
      const boxes = result.placed.filter((p) => p.kind === 'unit');
      for (const { y } of boxes) expect(boxes.filter((p) => p.y === y).length).toBeLessThanOrEqual(3);
      for (const task of [1, 2, 3]) {
        const [t, k] = [`t${task}`, `k${task}`].map((id) => boxes.find((p) => p.kind === 'unit' && p.unit.id === id)!);
        expect(t.y).toBe(k.y);
      }
      expect(boxes.every((p) => p.w >= 96)).toBe(true);
      expect(result.placed.every((p) => p.x >= 0 && p.x + p.w <= 343)).toBe(true);
      expect(clear(result)).toBe(true);
    });

    it('stands five parallel tasks in two lines, each box at least 96 wide, still clear', () => {
      const tasks = [1, 2, 3, 4, 5].map((task) => ({ task, steps: [step({ step: 'task_review', findings: [{ ...runFull.findings[1] }] }), step({ step: 'fix_check', round: 1 })] }));
      const timeline = [runFull.timeline[0], group({ kind: 'wave', label: 'Wave A', tasks }), runFull.timeline.at(-1)!];
      const result = layout(stagesOf(timeline), 343);
      const boxes = result.placed.filter((p) => p.kind === 'unit');
      expect(new Set(boxes.map((p) => p.y)).size).toBe(2);
      expect(boxes.every((p) => p.w >= 96)).toBe(true);
      expect(clear(result)).toBe(true);
    });
  });
});
