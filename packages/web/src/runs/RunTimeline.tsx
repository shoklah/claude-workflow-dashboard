import type { FindingRow, TimelineGroup, TimelineStep } from '@cwd/shared';
import { Badge } from '../components/ui/badge.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { stepLabel } from './format.ts';

function FindingItem({ finding }: { finding: FindingRow }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2">
      <span className="font-mono text-xs text-muted-foreground">{finding.id}</span>
      {finding.severity && <span className="text-xs text-muted-foreground">{finding.severity}</span>}
      <span>{finding.summary}</span>
      {finding.outcome && <Badge variant="outline">{finding.outcome}</Badge>}
      {finding.reason && <span className="basis-full text-muted-foreground">{finding.reason}</span>}
    </li>
  );
}

/** A step: its kind, round and counts; one with findings opens them. */
function Step({ step }: { step: TimelineStep }) {
  const counts = Object.entries(step.counts)
    .filter(([, n]) => n > 0)
    .map(([name, n]) => `${n} ${stepLabel(name)}`);
  const label = [stepLabel(step.step), step.round ? `round ${step.round}` : null, ...counts].filter(Boolean).join(' · ');
  if (step.findings.length === 0) return <div>{label}</div>;
  return (
    <details>
      <summary className="cursor-pointer">{label}</summary>
      <ul className="mt-1 ml-4 flex flex-col gap-1">
        {step.findings.map((finding, i) => (
          <FindingItem key={finding.id ?? i} finding={finding} />
        ))}
      </ul>
    </details>
  );
}

/** Steps in a box, named for screen readers too. */
function StepBox({ name, steps }: { name: string; steps: TimelineStep[] }) {
  return (
    <div role="group" aria-label={name} className="flex-1 rounded-md border border-dashed px-2 py-1.5">
      <div className="font-medium">{name}</div>
      {steps.map((step, i) => (
        <Step key={i} step={step} />
      ))}
    </div>
  );
}

function Group({ group, beforeSteps }: { group: TimelineGroup; beforeSteps: boolean }) {
  if (group.kind === 'start' || group.kind === 'end') {
    return (
      <div className="font-medium">
        {group.kind === 'start' ? 'Started' : 'Record written'}
        {group.at && (
          <span className="ml-2 font-normal text-muted-foreground">
            <Time iso={group.at} />
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-medium">{group.label}</div>
      {group.tasks.length > 0 && (
        <div className="flex gap-2">
          {group.tasks.map((task) => (
            <StepBox key={task.task} name={`Task ${task.task}`} steps={task.steps} />
          ))}
        </div>
      )}
      {group.kind === 'wave' && group.steps.length > 0 && <StepBox name="Wave check" steps={group.steps} />}
      {group.kind !== 'wave' && group.steps.map((step, i) => <Step key={i} step={step} />)}
      {beforeSteps && group.steps.length === 0 && (
        <p className="text-muted-foreground">Recorded before steps were logged: there are no steps to show.</p>
      )}
    </div>
  );
}

/**
 * The run's untimed timeline (decision 30): its groups in the workflow's order, times only at the start and the end,
 * a wave's tasks side by side, each step opening its findings.
 */
export function RunTimeline({ timeline, beforeSteps }: { timeline: TimelineGroup[]; beforeSteps: boolean }) {
  return (
    <ol className="ml-1.5 flex flex-col gap-3 border-l-2 pl-4 text-sm">
      {timeline.map((group, i) => (
        <li key={i}>
          <Group group={group} beforeSteps={beforeSteps} />
        </li>
      ))}
    </ol>
  );
}
