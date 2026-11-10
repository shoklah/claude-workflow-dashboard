import { Link } from '@tanstack/react-router';
import { Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cn } from 'cn';
import type { DiagramStep, FixLine, HomeResponse } from '@cwd/shared';
import { STEP_LABELS, WARNING_BORDER, WARNING_INK, plural, stepWarningsLabel } from '../lib/format.ts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.tsx';

type StepNode = Node<DiagramStep, 'step'>;

const BOX_WIDTH = 132;
const GAP = 40;

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
        'rounded-md bg-card px-2 py-1.5 text-center text-xs',
        warned ? cn('border-2', WARNING_BORDER) : 'border',
      )}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} style={{ visibility: 'hidden' }} />
      <div className="font-semibold">{STEP_LABELS[data.step]}</div>
      <div>ran {data.ran}</div>
      <div>
        {data.findings} found · {data.actedOn} acted on
      </div>
      {warned && (
        // React Flow turns pointer events off on a node no one can select, drag or click, so the link turns them on.
        <Link
          to="/compliance"
          search={{ step: data.step }}
          aria-label={stepWarningsLabel(data.warnings, data.step)}
          className={cn('pointer-events-auto underline underline-offset-2', WARNING_INK)}
        >
          {plural(data.warnings, 'warning')}
        </Link>
      )}
      <Handle type="source" position={Position.Right} isConnectable={false} style={{ visibility: 'hidden' }} />
    </div>
  );
}

const nodeTypes = { step: StepBox };

/** One path's steps, left to right, each joined to the next; a picture, not a canvas to edit. */
function Flow({ steps }: { steps: DiagramStep[] }) {
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
  return (
    <div className="h-32 [&_.react-flow\_\_attribution_a]:text-muted-foreground!">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ maxZoom: 1 }}
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
  );
}

function FixChecks({ line }: { line: FixLine }) {
  return (
    <p className="text-center text-xs text-muted-foreground">
      fix-checks: {line.ran} ran · {line.open} still open · {line.roundThree} reached round 3
    </p>
  );
}

/** The workflow over the last 7 days, a tab per path, with the fix-check line under each. */
export function WorkflowDiagram({ diagram }: { diagram: HomeResponse['diagram'] }) {
  return (
    <section aria-label="Workflow, last 7 days" className="flex flex-col gap-2">
      <Tabs defaultValue="full">
        <div className="flex items-center gap-3">
          <TabsList>
            <TabsTrigger value="full">Full path</TabsTrigger>
            <TabsTrigger value="small">Small path</TabsTrigger>
          </TabsList>
          <span className="text-sm text-muted-foreground">last 7 days</span>
        </div>
        <TabsContent value="full">
          <Flow steps={diagram.full} />
          <FixChecks line={diagram.fixChecks.full} />
        </TabsContent>
        <TabsContent value="small">
          <Flow steps={diagram.small} />
          <FixChecks line={diagram.fixChecks.small} />
        </TabsContent>
      </Tabs>
      {diagram.beforeSteps > 0 && (
        <p className="text-sm text-muted-foreground">{plural(diagram.beforeSteps, 'run')} before steps, not counted</p>
      )}
    </section>
  );
}
