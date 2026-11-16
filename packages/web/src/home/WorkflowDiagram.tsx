import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cn } from 'cn';
import type { DiagramStep, FixLine, HomeResponse } from '@cwd/shared';
import { STEP_LABELS, WARNING_BORDER, WARNING_INK, plural, stepWarningsLabel } from '../lib/format.ts';
import { Num } from '../components/Num.tsx';
import { Option } from '../components/Option.tsx';
import { Pairs, Panel } from '../components/Panel.tsx';

type StepNode = Node<DiagramStep, 'step'>;

const BOX_WIDTH = 132;
const GAP = 32;
// The room around the flow, so a box's border is never cut at the edge.
const PAD = 16;

/**
 * A step box: the step, how many ran, their findings and how many were acted on; with current warnings naming its step,
 * an orange border and their count, a link to Compliance filtered to that step.
 */
function StepBox({ data }: NodeProps<StepNode>) {
  const warned = data.warnings > 0;
  return (
    <div
      style={{ width: BOX_WIDTH }}
      className={cn(
        'rounded-lg bg-secondary px-2.5 py-2 text-xs',
        warned ? cn('border-2', WARNING_BORDER) : 'border',
      )}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} style={{ visibility: 'hidden' }} />
      <div className="mb-1 text-sm font-semibold">{STEP_LABELS[data.step]}</div>
      <Pairs
        className="gap-x-2 gap-y-0 text-xs"
        pairs={[
          ['Ran', <Num value={data.ran} />],
          ['Found', <Num value={data.findings} />],
          ['Acted on', <Num value={data.actedOn} />],
        ]}
      />
      {warned && (
        // React Flow turns pointer events off on a node no one can select, drag or click, so the link turns them on.
        <Link
          to="/compliance"
          search={{ step: data.step }}
          aria-label={stepWarningsLabel(data.warnings, data.step)}
          className={cn('pointer-events-auto mt-1 block underline underline-offset-2', WARNING_INK)}
        >
          {plural(data.warnings, 'warning')}
        </Link>
      )}
      <Handle type="source" position={Position.Right} isConnectable={false} style={{ visibility: 'hidden' }} />
    </div>
  );
}

const nodeTypes = { step: StepBox };

/** One path's steps, left to right, each joined to the next; a picture, not a canvas to edit. Drawn at full size, never
 * shrunk to fit: where the boxes are wider than the panel, the flow scrolls sideways in its own focusable region. */
function Flow({ steps, name }: { steps: DiagramStep[]; name: string }) {
  const nodes: StepNode[] = steps.map((step, i) => ({
    id: step.step,
    type: 'step',
    position: { x: i * (BOX_WIDTH + GAP), y: 0 },
    data: step,
    ariaRole: 'figure',
    ariaLabel: STEP_LABELS[step.step],
  }));
  const edges: Edge[] = steps.slice(1).map((step, i) => ({
    id: `${steps[i].step}-${step.step}`,
    source: steps[i].step,
    target: step.step,
    ariaLabel: `${STEP_LABELS[steps[i].step]}, then ${STEP_LABELS[step.step]}`,
  }));
  // React Flow's attribution stays (it asks to be hidden only with a Pro plan), in an ink dark enough to read;
  // marked important, since its CSS is unlayered and would beat the utility.
  const width = steps.length * (BOX_WIDTH + GAP) - GAP + 2 * PAD;
  return (
    <div tabIndex={0} role="region" aria-label={`Workflow steps, ${name}`} className="overflow-x-auto">
      <div style={{ minWidth: width }} className="h-40 [&_.react-flow\_\_attribution_a]:text-muted-foreground!">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ maxZoom: 1, padding: `${PAD}px` }}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          disableKeyboardA11y
        />
      </div>
    </div>
  );
}

/** The fix-check facts under the flow, a group named by its visible title. */
function FixChecks({ line }: { line: FixLine }) {
  return (
    <div role="group" aria-label="Fix-checks" className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t pt-3 text-sm">
      <span className="font-semibold">Fix-checks</span>
      <Pairs
        inline="beside"
        pairs={[
          ['Ran', <Num value={line.ran} />],
          ['Still open', <Num value={line.open} />],
          ['Reached round 3', <Num value={line.roundThree} />],
        ]}
      />
    </div>
  );
}

/** The workflow over the last 7 days on a panel, a switch per path, with the fix-check facts under the flow. */
export function WorkflowDiagram({ diagram }: { diagram: HomeResponse['diagram'] }) {
  const [path, setPath] = useState<'full' | 'small'>('full');
  return (
    <Panel
      title="Workflow, last 7 days"
      aside={
        <div role="group" aria-label="Path" className="flex flex-wrap gap-1">
          <Option pressed={path === 'full'} onClick={() => setPath('full')}>
            Full path
          </Option>
          <Option pressed={path === 'small'} onClick={() => setPath('small')}>
            Small path
          </Option>
        </div>
      }
    >
      <Flow key={path} steps={diagram[path]} name={path === 'full' ? 'Full path' : 'Small path'} />
      <FixChecks line={diagram.fixChecks[path]} />
      {diagram.beforeSteps > 0 && (
        <p className="text-sm text-muted-foreground">{plural(diagram.beforeSteps, 'run')} before steps, not counted</p>
      )}
    </Panel>
  );
}
