import type { GraphEdge, GraphNode, SessionGraphData } from '@cwd/shared';
import type { Edge } from '../runs/flow.ts';

/** A box, the gap between columns and between a column's stacked boxes, a lane's label, and the gap between lanes. */
const W = 160;
const H = 76;
const GX = 28;
const GY = 12;
const LABEL = 26;
const GAP = 24;

export type GraphLane = SessionGraphData['lanes'][number] & { y: number };
export type GraphBox = { node: GraphNode; x: number; y: number; w: number; h: number };
export type GraphLayout = {
  width: number;
  height: number;
  lanes: GraphLane[];
  boxes: GraphBox[];
  edges: (Edge & { how: GraphEdge['how']; across: boolean })[];
};

/** Each node's column: its distance from its chain's first session (a node no edge starts), breadth first; a loop
 * with no such node starts from its first node in the graph's order, so every node gets one and the walk ends. */
function columnsOf({ nodes, edges }: SessionGraphData): Map<string, number> {
  const column = new Map<string, number>();
  const walk = (starts: string[]) => {
    const queue = [...starts];
    for (const key of starts) column.set(key, 0);
    while (queue.length) {
      const key = queue.shift()!;
      for (const edge of edges) {
        if (edge.from === key && !column.has(edge.to)) {
          column.set(edge.to, column.get(key)! + 1);
          queue.push(edge.to);
        }
      }
    }
  };
  walk(nodes.filter((n) => !edges.some((e) => e.to === n.key)).map((n) => n.key));
  for (const n of nodes) if (!column.has(n.key)) walk([n.key]);
  return column;
}

/** Where an edge leaves its box: the right side for a box in its lane, else the bottom for a lower lane's box and the
 * top for a higher one's, or the right side again, crossing the column gap first, when a box of its own column stands
 * between it and its target's height. */
type Side = 'right' | 'bottom' | 'top';

/** Positions `n` starts spread evenly along a side of `length`. */
const fan = (length: number, i: number, n: number) => (length * (i + 1)) / (n + 1);

/** The session graph laid out at its own size: lanes top to bottom, each its label (with `labelled`, as the page says)
 * over its boxes, a box in its column with the boxes sharing its lane and column stacked; boxes in reading order (lane,
 * column, row). An edge in a lane runs from a box's right side to the next box's left; an edge between lanes
 * (`across`) runs as straight runs with rounded corners, up or down to its target's middle and into its left side. A
 * box's edges leaving one side start at points spread along it, so no two share a run. */
export function graphLayout(graph: SessionGraphData, labelled = false): GraphLayout {
  const label = labelled ? LABEL : 0;
  const column = columnsOf(graph);
  const row = new Map<string, number>();
  const stacks = new Map<string, number>();
  for (const node of graph.nodes) {
    const at = `${node.lane}|${column.get(node.key)}`;
    row.set(node.key, stacks.get(at) ?? 0);
    stacks.set(at, (stacks.get(at) ?? 0) + 1);
  }
  let y = 0;
  const lanes = graph.lanes.map((lane, i) => {
    const rows = Math.max(1, ...graph.nodes.filter((n) => n.lane === i).map((n) => row.get(n.key)! + 1));
    const placed = { ...lane, y };
    y += label + rows * H + (rows - 1) * GY + GAP;
    return placed;
  });
  const boxes = graph.nodes
    .map((node) => ({
      node,
      x: column.get(node.key)! * (W + GX),
      y: lanes[node.lane].y + label + row.get(node.key)! * (H + GY),
      w: W,
      h: H,
    }))
    .sort((a, b) => a.node.lane - b.node.lane || a.x - b.x || a.y - b.y);
  const box = new Map(boxes.map((b) => [b.node.key, b]));
  const mid = (b: GraphBox) => b.y + b.h / 2;
  const ends = graph.edges.map(({ from, to }) => [box.get(from)!, box.get(to)!] as const);
  const sides = ends.map(([a, b]): Side => {
    if (a.node.lane === b.node.lane) return 'right';
    const down = b.node.lane > a.node.lane;
    const [top, bottom] = down ? [a.y + a.h, mid(b)] : [mid(b), a.y];
    const blocked = boxes.some((c) => c !== a && c !== b && c.x === a.x && c.y < bottom && c.y + c.h > top);
    return blocked ? 'right' : down ? 'bottom' : 'top';
  });
  // Each edge's place among its box's edges leaving the same side: by its target's height, the lowest first along a
  // bottom, so an edge's run across never meets another's run down.
  const order = ends.map(([a], i) => {
    const peers = ends.map((_, j) => j).filter((j) => ends[j][0] === a && sides[j] === sides[i]);
    peers.sort((p, q) => (mid(ends[p][1]) - mid(ends[q][1])) * (sides[i] === 'bottom' ? -1 : 1));
    return { at: peers.indexOf(i), of: peers.length };
  });
  const edges = graph.edges.map(({ how }, i) => {
    const [a, b] = ends[i];
    const { at, of } = order[i];
    const to = { x: b.x, y: mid(b) };
    const across = a.node.lane !== b.node.lane;
    switch (sides[i]) {
      case 'right':
        return { from: { x: a.x + a.w, y: a.y + fan(a.h, at, of), ...(across && { lead: GX / 2 }) }, to, head: true, how, across };
      case 'bottom':
        return { from: { x: a.x + fan(a.w, at, of), y: a.y + a.h }, to, head: true, how, across };
      case 'top':
        return { from: { x: a.x + fan(a.w, at, of), y: a.y }, to, head: true, how, across };
    }
  });
  return {
    width: Math.max(0, ...boxes.map((b) => b.x + b.w)),
    height: Math.max(0, y - GAP),
    lanes,
    boxes,
    edges,
  };
}
