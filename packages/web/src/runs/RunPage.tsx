import type { ReactNode } from 'react';
import type { RunResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { WarningText } from '../components/WarningText.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.tsx';
import { CategoryBadge, FindingsTable } from './FindingsTable.tsx';
import { RunTimeline } from './RunTimeline.tsx';
import { NONE, findingsLabel, formatCost, formatMinutes, runName, strengthWhere } from '../lib/format.ts';

/** A titled list of the run's facts, "None" when it has none. */
function Section({ title, children }: { title: string; children: ReactNode[] }) {
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <h2 className="font-semibold">{title}</h2>
      {children.length === 0 ? <p className="text-muted-foreground">None</p> : <ul>{children}</ul>}
    </section>
  );
}

function Header({ run }: { run: RunResponse['facts'] }) {
  const facts = [
    ['Path · stage', `${run.path ?? NONE} · ${run.stage ?? NONE}`],
    ['Time', formatMinutes(run.minutes)],
    ['Est. cost', formatCost(run.cost)],
    ['Findings', findingsLabel(run)],
    ['Warnings', String(run.warnings)],
  ];
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold">{runName(run)}</h1>
      <dl className="flex flex-wrap gap-6">
        {facts.map(([term, value]) => (
          <div key={term}>
            <dt className="text-xs text-muted-foreground">{term}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * One run: its header, the untimed timeline with a toggle to every finding in one table and the reviewers' strengths
 * under it, and its skills, models, advisor notes and warnings for the run as a whole (decision 30).
 */
export function RunPage({ runKey }: { runKey: string }) {
  const run = useLiveQuery<RunResponse>(`/api/runs/${encodeURIComponent(runKey)}`);
  if (run.isPending) return <p className="text-sm text-muted-foreground">Loading the run…</p>;
  if (run.isError) return <p className="text-sm">Couldn't load this run.</p>;
  const { facts, timeline, findings, strengths, skills, models, advisor, warnings, categoryLabels } = run.data;
  return (
    <div className="flex flex-col gap-4">
      <Header run={facts} />
      <div className="flex flex-wrap items-start gap-6">
        <Tabs defaultValue="timeline" className="min-w-0 flex-1">
          <TabsList>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="findings">Findings</TabsTrigger>
          </TabsList>
          <TabsContent value="timeline">
            <RunTimeline timeline={timeline} beforeSteps={facts.beforeSteps} />
          </TabsContent>
          <TabsContent value="findings" className="flex flex-col gap-4">
            <FindingsTable findings={findings} categoryLabels={categoryLabels} />
            <Section title="Strengths">
              {strengths.map((strength, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                  <CategoryBadge category={strength.category} judge="workflow" labels={categoryLabels} />
                  <span>{strength.summary ?? NONE}</span>
                  <span className="text-muted-foreground">{strengthWhere(strength)}</span>
                </li>
              ))}
            </Section>
          </TabsContent>
        </Tabs>
        <div className="flex w-72 flex-col gap-4 text-sm">
          <Section title="Skills">
            {skills.map((skill, i) => (
              <li key={i}>
                {skill.name} <span className="text-muted-foreground">{skill.outcome}</span>
              </li>
            ))}
          </Section>
          <Section title="Models">
            {models.map((model) => (
              <li key={model.model}>
                {model.model} <span className="text-muted-foreground">{formatCost(model.cost)}</span>
              </li>
            ))}
          </Section>
          <Section title="Advisor">
            {advisor ? [<li key="advisor">{`${advisor.calls} calls · ${advisor.notes} notes`}</li>] : []}
          </Section>
          <Section title="Warnings">
            {warnings.map((warning, i) => (
              <li key={i}>
                <WarningText text={warning.text} sessionId={warning.sessionId} />
              </li>
            ))}
          </Section>
        </div>
      </div>
    </div>
  );
}
