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
  edges: (Edge & { how: GraphEdge['how']; down: boolean })[];
};

/** Whether the lanes carry their labels: only when the graph has more than one lane besides the other lane, so a
 * change's own lane and the sessions it linked to read without them. */
export function labelled(graph: SessionGraphData): boolean {
  return graph.lanes.filter((lane) => lane.kind !== 'other').length > 1;
}

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

/** The session graph laid out at its own size: lanes top to bottom, each its label (when `labelled`) over its boxes,
 * a box in its column with the boxes sharing its lane and column stacked; boxes in reading order (lane, column, row);
 * an edge from a box's right side to one in its lane or a higher one, and from its bottom down to the top of one in a
 * lower lane (`down`, drawn standing up). */
export function graphLayout(graph: SessionGraphData): GraphLayout {
  const label = labelled(graph) ? LABEL : 0;
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
  const edges = graph.edges.map(({ from, to, how }) => {
    const [a, b] = [box.get(from)!, box.get(to)!];
    if (b.node.lane > a.node.lane) {
      // Down to the gap above the lower lane, across it, then down through the lane's label to the box's top.
      const lane = lanes[b.node.lane].y;
      const start = { x: a.x + a.w / 2, y: a.y + a.h };
      const end = { x: b.x + b.w / 2, y: b.y, lead: b.y - lane };
      return { from: { ...start, lead: lane - GAP - start.y }, to: end, head: true, how, down: true };
    }
    return { from: { x: a.x + a.w, y: a.y + a.h / 2 }, to: { x: b.x, y: b.y + b.h / 2 }, head: true, how, down: false };
  });
  return {
    width: Math.max(0, ...boxes.map((b) => b.x + b.w)),
    height: Math.max(0, y - GAP),
    lanes,
    boxes,
    edges,
  };
}
