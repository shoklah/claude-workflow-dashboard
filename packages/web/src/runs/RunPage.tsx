import { useId, useState, type ReactNode } from 'react';
import type { RunResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { Num, Text } from '../components/Num.tsx';
import { Option } from '../components/Option.tsx';
import { PageTitle, Pairs, Panel, SectionTitle, State } from '../components/Panel.tsx';
import { WarningText } from '../components/WarningText.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { CategoryBadge, FindingsTable } from './FindingsTable.tsx';
import { RunTimeline } from './RunTimeline.tsx';
import {
  closedFindings,
  formatCompact,
  formatCost,
  formatMinutes,
  formatShare,
  modelLabel,
  pathLabel,
  strengthWhere,
} from '../lib/format.ts';

/** A titled section of the side panel, its `none` line when it has nothing to show. */
function Section({ title, none, children }: { title: string; none: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-1.5 border-b pb-4 last:border-0 last:pb-0">
      <SectionTitle id={titleId}>{title}</SectionTitle>
      {children || <p className="text-sm text-muted-foreground">{none}</p>}
    </section>
  );
}

/** The run's facts, each a term over its value. */
function Header({ run }: { run: RunResponse['facts'] }) {
  const facts: [string, ReactNode][] = [
    ['Project', <Text value={run.project} />],
    ['Path', <Text value={pathLabel(run.path)} />],
    ['Stage', <Text value={run.stage} />],
    ['Time', <Num value={run.minutes} format={formatMinutes} />],
    ['Est. cost', <Num value={run.cost} format={formatCost} />],
    ['Findings', <Num value={run.beforeSteps ? null : run.findings.total} />],
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
 * One run: its branch and facts, the untimed timeline with a switch to every finding in one table and the reviewers'
 * strengths under it, and its skills, models, advisor notes, context and warnings for the run as a whole (decision 30).
 */
export function RunPage({ runKey }: { runKey: string }) {
  const run = useLiveQuery<RunResponse>(`/api/runs/${encodeURIComponent(runKey)}`);
  const [view, setView] = useState<'timeline' | 'findings'>('timeline');
  if (run.isPending) return <State>Loading the run…</State>;
  if (run.isError) return <State error>Couldn't load this run.</State>;
  const { facts, timeline, findings, strengths, skills, models, advisor, context, warnings, categoryLabels } = run.data;
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{facts.branch ?? 'Run'}</PageTitle>
      <Header run={facts} />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div role="group" aria-label="View" className="flex flex-wrap gap-1">
            <Option pressed={view === 'timeline'} onClick={() => setView('timeline')}>
              Timeline
            </Option>
            <Option pressed={view === 'findings'} onClick={() => setView('findings')}>
              Findings
            </Option>
          </div>
          {view === 'timeline' ? (
            <Panel>
              <RunTimeline timeline={timeline} beforeSteps={facts.beforeSteps} />
            </Panel>
          ) : (
            <>
              <FindingsTable findings={findings} categoryLabels={categoryLabels} />
              <Panel title="Strengths" className="text-sm">
                {strengths.length === 0 ? (
                  <p className="text-muted-foreground">No strengths recorded.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {strengths.map((strength, i) => (
                      <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                        <CategoryBadge category={strength.category} labels={categoryLabels} />
                        <span>
                          <Text value={strength.summary} />
                        </span>
                        <span className="text-muted-foreground">{strengthWhere(strength)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </>
          )}
        </div>
        <Panel className="gap-4 lg:w-80 lg:flex-none">
          <Section title="Skills" none="No skill loaded.">
            {skills.length > 0 && <Pairs names pairs={skills.map((skill) => [skill.name, skill.outcome])} />}
          </Section>
          <Section title="Models" none="No model recorded.">
            {models.length > 0 && (
              <Pairs names pairs={models.map((model) => [<Text value={modelLabel(model.model)} />, formatCost(model.cost)])} />
            )}
          </Section>
          <Section title="Advisor" none="Not consulted.">
            {advisor && (
              <Pairs
                pairs={[
                  ['Calls', <Num value={advisor.calls} />],
                  ['Notes', <Num value={advisor.notes} />],
                ]}
              />
            )}
          </Section>
          <Section title="Context" none="No context facts for this run.">
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
          </Section>
          <Section title="Warnings" none="No warnings.">
            {warnings.length > 0 && (
              <ul className="flex flex-col gap-2 text-sm">
                {warnings.map((warning, i) => (
                  <li key={i} className="flex flex-col gap-0.5">
                    <WarningText text={warning.text} sessionId={warning.sessionId} branch={facts.branch} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </Panel>
      </div>
    </div>
  );
}
