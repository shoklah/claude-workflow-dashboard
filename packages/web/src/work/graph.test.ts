import { describe, expect, it } from 'vitest';
import type { GraphNode, SessionGraphData } from '@cwd/shared';
import { graphLayout, labelled } from './graph.ts';

const node = (key: string, lane = 0): GraphNode => ({ key, title: key, step: 'design', run: null, lane, elsewhere: null });
const lane = (key: string, kind: 'change' | 'none' | 'other' = 'change') => ({ key, title: key, kind });
const graph = (g: Partial<SessionGraphData>): SessionGraphData => ({ lanes: [lane('c')], nodes: [], edges: [], hidden: 0, ...g });
const boxOf = (layout: ReturnType<typeof graphLayout>, key: string) => layout.boxes.find((b) => b.node.key === key)!;

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

  it("leaves a box's right side for one in its lane, and its bottom for one in a lower lane", () => {
    const layout = graphLayout(
      graph({
        lanes: [lane('c'), lane('o', 'other')],
        nodes: [node('a'), node('b'), node('x', 1)],
        edges: [
          { from: 'a', to: 'b', how: 'started' },
          { from: 'a', to: 'x', how: 'handoff' },
        ],
      }),
    );
    const [a, b, x] = ['a', 'b', 'x'].map((k) => boxOf(layout, k));
    const [same, lower] = layout.edges;
    expect(same).toMatchObject({ how: 'started', down: false, from: { x: a.x + a.w, y: a.y + a.h / 2 }, to: { x: b.x, y: b.y + b.h / 2 } });
    expect(lower).toMatchObject({ how: 'handoff', down: true, from: { y: a.y + a.h }, to: { y: x.y } });
    expect(x.y).toBeGreaterThan(a.y + a.h);
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

  it('labels its lanes only when it has more than one besides the other lane', () => {
    expect(labelled(graph({ lanes: [lane('c'), lane('o', 'other')] }))).toBe(false);
    expect(labelled(graph({ lanes: [lane('c'), lane('n', 'none')] }))).toBe(true);
    const plain = graphLayout(graph({ lanes: [lane('c')], nodes: [node('a')] }));
    const named = graphLayout(graph({ lanes: [lane('c'), lane('d')], nodes: [node('a'), node('b', 1)] }));
    expect(boxOf(plain, 'a').y).toBe(0);
    expect(boxOf(named, 'a').y).toBe(26);
  });
});
