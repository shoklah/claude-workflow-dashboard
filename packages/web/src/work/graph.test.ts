import { describe, expect, it } from 'vitest';
import type { GraphNode, SessionGraphData } from '@cwd/shared';
import { graphLayout } from './graph.ts';

const node = (key: string, lane = 0): GraphNode => ({ key, title: key, step: 'design', run: null, lane, elsewhere: null });
const lane = (key: string, kind: 'change' | 'none' | 'other' = 'change') => ({ key, title: key, kind });
const graph = (g: Partial<SessionGraphData>): SessionGraphData => ({ lanes: [lane('c')], nodes: [], edges: [], hidden: 0, ...g });
type Layout = ReturnType<typeof graphLayout>;
const boxOf = (layout: Layout, key: string) => layout.boxes.find((b) => b.node.key === key)!;
type Rect = { x: number; y: number; w: number; h: number };
/** An edge's straight runs as thin rectangles: an elbow's start, its lead across, its run up or down and its run
 * into its end; a curve's, the rectangle it lies in. */
function runsOf({ from, to, across }: Layout['edges'][number]): Rect[] {
  const span = (a: number, b: number) => [Math.min(a, b), Math.abs(b - a)];
  if (!across) {
    const [x, w] = span(from.x, to.x);
    const [y, h] = span(from.y, to.y);
    return [{ x, y, w, h }];
  }
  const x = from.x + (from.lead ?? 0);
  const [lx, lw] = span(from.x, x);
  const [vy, vh] = span(from.y, to.y);
  const [hx, hw] = span(x, to.x);
  return [
    { x: lx, y: from.y, w: lw, h: 0 },
    { x, y: vy, w: 0, h: vh },
    { x: hx, y: to.y, w: hw, h: 0 },
  ];
}
/** A run passes through a box's inside, not along its border. */
const through = (r: Rect, b: Rect) => r.x < b.x + b.w && b.x < r.x + r.w && r.y < b.y + b.h && b.y < r.y + r.h;
/** The keys of the boxes an edge passes through that it doesn't end in. */
function crossed(layout: Layout): string[] {
  return layout.edges.flatMap((edge) => {
    const ends = layout.boxes.filter((b) => [edge.from, edge.to].some((p) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h));
    return layout.boxes.filter((b) => !ends.includes(b) && runsOf(edge).some((r) => through(r, b))).map((b) => b.node.key);
  });
}
const twoLanes = [lane('c'), lane('o', 'other')];

describe('graphLayout', () => {
  it("puts a node in the column of its distance from its chain's first session", () => {
    const layout = graphLayout(
      graph({
        nodes: [node('a'), node('b'), node('c'), node('d')],
        edges: [
          { from: 'a', to: 'b', how: 'handoff' },
          { from: 'b', to: 'c', how: 'started' },
        ],
      }),
    );
    expect(['a', 'b', 'c', 'd'].map((k) => boxOf(layout, k).x)).toEqual([0, 188, 376, 0]);
    expect(boxOf(layout, 'a')).toMatchObject({ w: 160, h: 76 });
  });

  it('stacks the nodes sharing a lane and a column', () => {
    const layout = graphLayout(
      graph({
        nodes: [node('a'), node('b'), node('c')],
        edges: [
          { from: 'a', to: 'b', how: 'started' },
          { from: 'a', to: 'c', how: 'started' },
        ],
      }),
    );
    const [b, c] = [boxOf(layout, 'b'), boxOf(layout, 'c')];
    expect(b.x).toBe(c.x);
    expect(c.y).toBeGreaterThanOrEqual(b.y + b.h);
  });

  it("leaves a box's right side for one in its lane, and enters a lower lane's box from its left side", () => {
    const layout = graphLayout(
      graph({
        lanes: twoLanes,
        nodes: [node('a'), node('b'), node('x', 1)],
        edges: [
          { from: 'a', to: 'b', how: 'started' },
          { from: 'a', to: 'x', how: 'handoff' },
        ],
      }),
    );
    const [a, b, x] = ['a', 'b', 'x'].map((k) => boxOf(layout, k));
    const [same, lower] = layout.edges;
    expect(same).toMatchObject({ how: 'started', across: false, from: { x: a.x + a.w }, to: { x: b.x, y: b.y + b.h / 2 } });
    expect(lower).toMatchObject({ how: 'handoff', across: true, from: { y: a.y + a.h }, to: { x: x.x, y: x.y + x.h / 2 } });
    expect(x.y).toBeGreaterThan(a.y + a.h);
  });

  it("enters a higher lane's box from its left side", () => {
    const layout = graphLayout(graph({ lanes: twoLanes, nodes: [node('m'), node('p', 1)], edges: [{ from: 'p', to: 'm', how: 'started' }] }));
    const [m, p] = ['m', 'p'].map((k) => boxOf(layout, k));
    expect(layout.edges[0]).toMatchObject({ across: true, from: { y: p.y }, to: { x: m.x, y: m.y + m.h / 2 } });
  });

  it('runs no edge through a box it does not end in, and starts two edges of one box at different points', () => {
    const cases = [
      // A starts X and Y in the lower lane, where they stack.
      graph({ lanes: twoLanes, nodes: [node('a'), node('x', 1), node('y', 1)], edges: [{ from: 'a', to: 'x', how: 'started' }, { from: 'a', to: 'y', how: 'handoff' }] }),
      // P in the lower lane starts M and N, which stack in the upper one.
      graph({ lanes: twoLanes, nodes: [node('m'), node('n'), node('p', 1)], edges: [{ from: 'p', to: 'm', how: 'started' }, { from: 'p', to: 'n', how: 'handoff' }] }),
      // R starts A and B, which stack; A, over B, starts X in the lower lane.
      graph({
        lanes: twoLanes,
        nodes: [node('r'), node('a'), node('b'), node('x', 1)],
        edges: [{ from: 'r', to: 'a', how: 'started' }, { from: 'r', to: 'b', how: 'started' }, { from: 'a', to: 'x', how: 'started' }],
      }),
    ];
    for (const g of cases) {
      const layout = graphLayout(g);
      expect(crossed(layout)).toEqual([]);
      const starts = layout.edges.map((e) => `${e.from.x},${e.from.y}`);
      expect(new Set(starts).size).toBe(starts.length);
    }
  });

  it('gives a loop of two nodes columns 0 and 1, and ends', () => {
    const layout = graphLayout(
      graph({
        nodes: [node('a'), node('b')],
        edges: [
          { from: 'a', to: 'b', how: 'started' },
          { from: 'b', to: 'a', how: 'started' },
        ],
      }),
    );
    expect([boxOf(layout, 'a').x, boxOf(layout, 'b').x]).toEqual([0, 188]);
    expect(layout.edges).toHaveLength(2);
  });

  it('is as wide and as tall as every box', () => {
    const layout = graphLayout(
      graph({
        lanes: [lane('c'), lane('n', 'none'), lane('o', 'other')],
        nodes: [node('a'), node('b', 1), node('c', 2), node('d', 2)],
        edges: [{ from: 'a', to: 'd', how: 'started' }],
      }),
    );
    for (const box of layout.boxes) {
      expect(box.x + box.w).toBeLessThanOrEqual(layout.width);
      expect(box.y + box.h).toBeLessThanOrEqual(layout.height);
    }
    expect(layout.lanes.map((l) => l.y)).toEqual([...layout.lanes.map((l) => l.y)].sort((p, q) => p - q));
  });

  it('puts a label over each lane only when the page labels them', () => {
    const g = graph({ lanes: twoLanes, nodes: [node('a'), node('b', 1)] });
    expect(boxOf(graphLayout(g), 'a').y).toBe(0);
    expect(boxOf(graphLayout(g, true), 'a').y).toBe(26);
  });
});
