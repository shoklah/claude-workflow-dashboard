import { useId, useMemo } from 'react';
import { cn } from 'cn';
import type { GraphNode, SessionGraphData } from '@cwd/shared';
import { ChangeLink } from '../components/ChangeLink.tsx';
import { Text } from '../components/Num.tsx';
import { Line, Panel } from '../components/Panel.tsx';
import { runName } from '../components/RunLink.tsx';
import { SessionLink } from '../components/SessionLink.tsx';
import { STAGE_LABELS, hiddenLabel } from '../lib/format.ts';
import { Arrowhead, BOX, at, pathOf } from '../runs/RunFlow.tsx';
import { graphLayout, type GraphBox } from './graph.ts';

/** A handoff's dashes, on its edges and in the legend. */
const HANDOFF = '4 4';


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
  const run = node.run && runName(node.run.title, node.run.branch);
  const where = node.elsewhere && elsewhereLabel(node.elsewhere, label);
  return (
    <div className={cn(BOX, where && 'border-dashed bg-transparent')} style={at(box)}>
      <SessionLink sessionKey={node.key} title={node.title} className="truncate text-sm font-semibold" />
      <span className="truncate text-xs text-muted-foreground">{STAGE_LABELS[node.step]}</span>
      {node.run && (
        <span title={run ?? undefined} className="truncate text-xs">
          {'Run: '}
          <Text value={run} unknown="no branch" />
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
 * "How the work spread": the sessions of a change or goal (`label`) as a graph, its lanes labelled on a goal's page, laid out by `graphLayout` at its own
 * size and never shrunk, in a focusable region that scrolls sideways; the edges an SVG hidden from assistive tech, the
 * lanes' labels and the boxes HTML at their places, in reading order. The legend shows with an edge to explain, and a
 * line says how many sessions showing mode left out.
 */
export function SessionGraph({ graph, label }: { graph: SessionGraphData; label: string }) {
  const id = useId();
  // A goal's page labels its lanes; a change's page, one lane and the sessions it linked to, needs none.
  const named = label === 'goal';
  const { width, height, lanes, boxes, edges } = useMemo(() => graphLayout(graph, named), [graph, named]);
  return (
    <Panel title="How the work spread" aside={edges.length > 0 && <Legend label={label} />}>
      {boxes.length === 0 ? (
        <Line muted>{`No session of this ${label} is in the data.`}</Line>
      ) : (
        <div data-scroll-cue tabIndex={0} role="region" aria-label={`Sessions of this ${label}, as a graph`} className="overflow-x-auto">
          <div className="relative" style={{ width, height }}>
            <svg aria-hidden className="absolute inset-0 overflow-visible text-muted-foreground" width={width} height={height}>
              <defs>
                <Arrowhead id={`${id}-head`} />
              </defs>
              {edges.map((edge, i) => (
                <path
                  key={i}
                  d={pathOf(edge, edge.across ? 'elbow' : 'flat')}
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
