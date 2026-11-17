import { useId, useMemo, type CSSProperties } from 'react';
import { cn } from 'cn';
import type { GraphNode, SessionGraphData } from '@cwd/shared';
import { ChangeLink } from '../components/ChangeLink.tsx';
import { Line, Panel } from '../components/Panel.tsx';
import { SessionLink } from '../components/SessionLink.tsx';
import { STAGE_LABELS, hiddenLabel } from '../lib/format.ts';
import { BOX, pathOf } from '../runs/RunFlow.tsx';
import { graphLayout, labelled, type GraphBox } from './graph.ts';

/** A handoff's dashes, on its edges and in the legend. */
const HANDOFF = '4 4';

const at = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }): CSSProperties => ({ left: x, top: y, width: w, height: h });

/** Where a session of the other lane belongs, seen from a page of `label` ("change" or "goal"). */
function elsewhereLabel(elsewhere: NonNullable<GraphNode['elsewhere']>, label: string): string {
  switch (elsewhere.kind) {
    case 'change':
      return `Other change: ${elsewhere.title}`;
    case 'goal':
      return label === 'goal' ? `Goal: ${elsewhere.name}` : `Other goal: ${elsewhere.name}`;
    case 'none':
      return 'No change';
    case 'unlisted':
      return `Another ${label}`;
  }
}

/** A session's box: its title linking to it, its step, the run it holds, and, outlined dashed with no fill, where a
 * session of the other lane belongs. Each line truncates, its whole text in its tooltip. */
function Box({ box, label }: { box: GraphBox; label: string }) {
  const { node } = box;
  const run = node.run && `Run: ${node.run.title || node.run.branch || 'no branch'}`;
  const where = node.elsewhere && elsewhereLabel(node.elsewhere, label);
  return (
    <div className={cn(BOX, where && 'border-dashed bg-transparent')} style={at(box)}>
      <SessionLink sessionKey={node.key} title={node.title} className="truncate text-sm font-semibold" />
      <span className="truncate text-xs text-muted-foreground">{STAGE_LABELS[node.step]}</span>
      {run && (
        <span title={run} className="truncate text-xs">
          {run}
        </span>
      )}
      {where && (
        <span title={where} className="truncate text-xs text-muted-foreground">
          {where}
        </span>
      )}
    </div>
  );
}

/** The legend: a started edge, a handoff's and the outline of a session belonging to another change or goal. */
function Legend({ label }: { label: string }) {
  const edge = (dashes?: string) => (
    <svg aria-hidden width="28" height="8" className="flex-none text-muted-foreground">
      <path d="M0 4 H28" stroke="currentColor" strokeWidth={1.5} strokeDasharray={dashes} />
    </svg>
  );
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-2">
        {edge()}
        Started
      </li>
      <li className="flex items-center gap-2">
        {edge(HANDOFF)}
        Handed off
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden className="h-3 w-4 flex-none rounded-sm border border-dashed" />
        {`Belongs to another ${label}`}
      </li>
    </ul>
  );
}

/**
 * "How the work spread": the sessions of a change or goal (`label`) as a graph, laid out by `graphLayout` at its own
 * size and never shrunk, in a focusable region that scrolls sideways; the edges an SVG hidden from assistive tech, the
 * lanes' labels and the boxes HTML at their places, in reading order. The legend shows with an edge to explain, and a
 * line says how many sessions showing mode left out.
 */
export function SessionGraph({ graph, label }: { graph: SessionGraphData; label: string }) {
  const id = useId();
  const { width, height, lanes, boxes, edges } = useMemo(() => graphLayout(graph), [graph]);
  const named = labelled(graph);
  return (
    <Panel title="How the work spread" aside={edges.length > 0 && <Legend label={label} />}>
      {boxes.length === 0 ? (
        <Line muted>{`No session of this ${label} is in the data.`}</Line>
      ) : (
        <div data-scroll-cue tabIndex={0} role="region" aria-label={`Sessions of this ${label}, as a graph`} className="overflow-x-auto">
          <div className="relative" style={{ width, height }}>
            <svg aria-hidden className="absolute inset-0 overflow-visible text-muted-foreground" width={width} height={height}>
              <defs>
                <marker id={`${id}-head`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
                </marker>
              </defs>
              {edges.map((edge, i) => (
                <path
                  key={i}
                  d={pathOf(edge, edge.down ? 'upright' : 'flat')}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeDasharray={edge.how === 'handoff' ? HANDOFF : undefined}
                  markerEnd={`url(#${id}-head)`}
                />
              ))}
            </svg>
            {named &&
              lanes.map((lane, i) => (
                <div
                  key={i}
                  className={cn('absolute flex h-[26px] items-start text-xs font-medium whitespace-nowrap', i > 0 && 'border-t pt-1.5')}
                  style={{ left: 0, top: i > 0 ? lane.y - 12 : lane.y, width }}
                >
                  {lane.kind === 'change' && lane.key ? <ChangeLink changeKey={lane.key} title={lane.title} /> : lane.title}
                </div>
              ))}
            {boxes.map((box) => (
              <Box key={box.node.key} box={box} label={label} />
            ))}
          </div>
        </div>
      )}
      {graph.hidden > 0 && <Line muted>{hiddenLabel(graph.hidden, 'session')}</Line>}
    </Panel>
  );
}
