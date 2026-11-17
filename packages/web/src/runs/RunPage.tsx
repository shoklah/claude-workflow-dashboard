import { useState, type ReactNode } from 'react';
import type { RunPageResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { Num, Text } from '../components/Num.tsx';
import { PageTitle, Pairs, Panel, Section, State } from '../components/Panel.tsx';
import { WarningText } from '../components/WarningText.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { FindingsTable } from './FindingsTable.tsx';
import { stagesOf, unitsOf } from './flow.ts';
import { RunFlow } from './RunFlow.tsx';
import { StepDetail } from './StepDetail.tsx';
import {
  categoryLabel,
  closedFindings,
  formatCompact,
  formatCost,
  formatMinutes,
  formatShare,
  foundFindings,
  modelLabel,
  pathLabel,
  strengthWhere,
} from '../lib/format.ts';

/** A titled section of the side panel, its `none` line when it has nothing to show. */
function SideSection({ title, none, children }: { title: string; none: string; children: ReactNode }) {
  return (
    <Section title={title} className="gap-1.5 border-b pb-4 last:border-0 last:pb-0">
      {children || <p className="text-sm text-muted-foreground">{none}</p>}
    </Section>
  );
}

/** The run's facts, each a term over its value. */
function Header({ run }: { run: RunPageResponse['facts'] }) {
  const facts: [string, ReactNode][] = [
    ['Project', <Text value={run.project} />],
    ['Path', <Text value={pathLabel(run.path)} />],
    ['Stage', <Text value={run.stage} />],
    ['Time', <Num value={run.minutes} format={formatMinutes} />],
    ['Est. cost', <Num value={run.cost} format={formatCost} />],
    ['Findings', <Num value={foundFindings(run)} />],
    ['Closed', <Num value={closedFindings(run)} />],
    ['Warnings', <Num value={run.warnings} />],
  ];
  return (
    <Panel className="py-3">
      <Pairs inline="over" className="gap-x-10 gap-y-3" pairs={facts} />
    </Panel>
  );
}

/**
 * One run: its branch and facts, the run drawn as a graph with every finding in one table and the reviewers' strengths
 * under it, and its skills, models, advisor notes, context and warnings for the run as a whole (decision 30).
 */
export function RunPage({ runKey }: { runKey: string }) {
  const run = useLiveQuery<RunPageResponse>(`/api/runs/${encodeURIComponent(runKey)}`);
  // The selection holds its run's key: unit ids repeat across runs, and the route keeps this page when only the key changes.
  const [selection, setSelection] = useState<{ runKey: string; unit: string } | null>(null);
  const selected = selection?.runKey === runKey ? selection.unit : null;
  const select = (unit: string | null) => setSelection(unit === null ? null : { runKey, unit });
  if (run.isPending) return <State>Loading the run…</State>;
  if (run.isError) return <State error>Couldn't load this run.</State>;
  const { facts, timeline, findings, strengths, skills, models, advisor, context, warnings, categoryLabels } = run.data;
  const stages = stagesOf(timeline);
  const unit = unitsOf(stages).find((u) => u.id === selected);
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{facts.branch ?? 'Run'}</PageTitle>
      <Header run={facts} />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Panel title="Flow">
            {facts.beforeSteps ? (
              <p className="text-sm text-muted-foreground">Recorded before steps were logged: there is no flow to draw.</p>
            ) : (
              <RunFlow stages={stages} selected={selected} onSelect={select} />
            )}
            {!facts.beforeSteps && (
              <div className="border-t pt-3 text-sm">
                {unit ? (
                  <StepDetail unit={unit} onClose={() => select(null)} />
                ) : (
                  <p className="text-muted-foreground">Select a task or a review to see its rounds, and its findings below.</p>
                )}
              </div>
            )}
          </Panel>
          <FindingsTable findings={findings} categoryLabels={categoryLabels} />
          <Panel title="Strengths" className="text-sm">
            {strengths.length === 0 ? (
              <p className="text-muted-foreground">No strengths recorded.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {strengths.map((strength, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                    {categoryLabel(strength.category, categoryLabels)}
                    <span>
                      <Text value={strength.summary} />
                    </span>
                    <span className="text-muted-foreground">{strengthWhere(strength)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <Panel className="gap-4 lg:w-80 lg:flex-none">
          <SideSection title="Skills" none="No skill loaded.">
            {skills.length > 0 && <Pairs names pairs={skills.map((skill) => [skill.name, skill.outcome])} />}
          </SideSection>
          <SideSection title="Models" none="No model recorded.">
            {models.length > 0 && (
              <Pairs names pairs={models.map((model) => [<Text value={modelLabel(model.model)} />, formatCost(model.cost)])} />
            )}
          </SideSection>
          <SideSection title="Advisor" none="Not consulted.">
            {advisor && (
              <Pairs
                pairs={[
                  ['Calls', <Num value={advisor.calls} />],
                  ['Notes', <Num value={advisor.notes} />],
                ]}
              />
            )}
          </SideSection>
          <SideSection title="Context" none="No context facts for this run.">
            {context && (
              <Pairs
                pairs={[
                  ['Calls', <Num value={context.calls} />],
                  ['Median tokens', <Num value={context.medianTokens} format={formatCompact} />],
                  ['Largest tokens', <Num value={context.maxTokens} format={formatCompact} />],
                  ['Calls past the cap', <Num value={context.callsOverCap} />],
                  ['Handed off', context.handoff ? <Time iso={context.handoff} /> : <span className="text-muted-foreground">no</span>],
                  ['Tool results (characters)', formatCompact(context.toolCharacters)],
                  ['Read share', <Num value={context.readShare} format={formatShare} />],
                  ['Sweeps inline', <Num value={context.sweeps.inline} />],
                  ['Sweeps delegated', <Num value={context.sweeps.delegated} />],
                ]}
              />
            )}
          </SideSection>
          <SideSection title="Warnings" none="No warnings.">
            {warnings.length > 0 && (
              <ul className="flex flex-col gap-2 text-sm">
                {warnings.map((warning, i) => (
                  <li key={i} className="flex flex-col gap-0.5">
                    <WarningText text={warning.text} sessionId={warning.sessionId} branch={facts.branch} />
                  </li>
                ))}
              </ul>
            )}
          </SideSection>
        </Panel>
      </div>
    </div>
  );
}
