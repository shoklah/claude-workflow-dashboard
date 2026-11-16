import type { FindingRow, TimelineGroup, TimelineStep } from '@cwd/shared';
import { Time } from '../layout/StatusBanner.tsx';
import { STEP_LABELS, countLines, countName, formatWhole } from '../lib/format.ts';

function FindingItem({ finding }: { finding: FindingRow }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-xs text-muted-foreground tabular-nums">{finding.id}</span>
      {finding.severity && <span className="text-xs text-muted-foreground">{countName(finding.severity)}</span>}
      <span>{finding.summary}</span>
      {finding.outcome && <span className="text-xs text-muted-foreground">{countName(finding.outcome)}</span>}
      {finding.reason && <span className="basis-full text-muted-foreground">{finding.reason}</span>}
    </li>
  );
}

/** A step: its kind (unless it is the one step its group is named for), round and counts, each its own word; one with
 * findings opens them. */
function Step({ step, within = '' }: { step: TimelineStep; within?: string }) {
  const counts = (countLines(step.counts) ?? [])
    .filter(([, n]) => n! > 0)
    .map(([name, n]) => `${name} ${formatWhole(n!)}`);
  const name = STEP_LABELS[step.step];
  const label = (
    <span className="inline-flex flex-wrap gap-x-4">
      {name.toLowerCase() !== within.toLowerCase() && <span>{name}</span>}
      {step.round ? <span className="text-muted-foreground">Round {formatWhole(step.round)}</span> : null}
      {counts.length === 0 ? (
        <span className="text-muted-foreground">No findings</span>
      ) : (
        counts.map((count) => (
          <span key={count} className="tabular-nums">
            {count}
          </span>
        ))
      )}
    </span>
  );
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
    <div role="group" aria-label={name} className="min-w-0 flex-1 rounded-lg border px-3 py-2">
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
      <div className="font-semibold">
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
      <div className="font-semibold">{group.label}</div>
      {group.kind !== 'wave' &&
        group.tasks.length === 1 &&
        group.tasks[0].steps.map((step, i) => <Step key={i} step={step} within={group.label} />)}
      {(group.kind === 'wave' || group.tasks.length > 1) && group.tasks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {group.tasks.map((task) => (
            <StepBox key={task.task} name={`Task ${task.task}`} steps={task.steps} />
          ))}
        </div>
      )}
      {group.kind === 'wave' && group.steps.length > 0 && <StepBox name="Wave check" steps={group.steps} />}
      {group.kind !== 'wave' && group.steps.map((step, i) => <Step key={i} step={step} within={group.label} />)}
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
