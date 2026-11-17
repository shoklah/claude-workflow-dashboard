import { useState, type ReactNode } from 'react';
import { ArrowRight, ThumbsUp, TriangleAlert } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import { parseTime, type RunPageResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { Num, Text } from '../components/Num.tsx';
import { LINK, PageTitle, Pairs, Panel, Section, State } from '../components/Panel.tsx';
import { SessionChip } from '../components/SessionChip.tsx';
import { WarningText } from '../components/WarningText.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { FindingsTable } from './FindingsTable.tsx';
import { LaterFixesTerm, LeftForLater } from './LeftForLater.tsx';
import { stagesOf, strengthsOf, unitsOf } from './flow.ts';
import { RunFlow } from './RunFlow.tsx';
import { StepDetail } from './StepDetail.tsx';
import { StrengthsTable } from './StrengthsTable.tsx';
import {
  closedFindings,
  formatCompact,
  formatCost,
  formatMinutes,
  formatShare,
  foundFindings,
  laterFixesLabel,
  modelLabel,
  pathLabel,
  PROBLEMS_INK,
  PROBLEMS_SIDE,
  STRENGTHS_INK,
  STRENGTHS_SIDE,
  WARNING_INK,
} from '../lib/format.ts';

/** A titled section of the side panel, its `none` line when it has nothing to show. */
function SideSection({ title, none, children }: { title: string; none: string; children: ReactNode }) {
  return (
    <Section title={title} className="gap-1.5 border-b pb-4 last:border-0 last:pb-0">
      {children || <p className="text-sm text-muted-foreground">{none}</p>}
    </Section>
  );
}

/** A findings table's title: its icon, then its words. */
function TableTitle({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      {icon}
      {text}
    </span>
  );
}

/** A findings section with nothing to list: its title, then its one line in a panel with the section's side. */
function NoneLine({ title, side, children }: { title: ReactNode; side: string; children: string }) {
  return (
    <Section title={title}>
      <State className={side}>{children}</State>
    </Section>
  );
}

/** A box of the header's chain; `dashed` for what isn't a run (a handoff, later fixes). */
function ChainBox({ dashed = false, current = false, children }: { dashed?: boolean; current?: boolean; children: ReactNode }) {
  return (
    <div aria-current={current ? 'page' : undefined} className={cn('flex min-w-0 flex-col rounded-lg border px-3 py-1.5', dashed && 'border-dashed')}>
      {children}
    </div>
  );
}

/** A chain box's second line, muted. */
function Under({ children }: { children: ReactNode }) {
  return <span className="text-xs text-muted-foreground">{children}</span>;
}

/** A related run finished before this run's `at`: false when either time isn't known, so it goes after. */
function before(run: RunPageResponse['related'][number], at: string | null): boolean {
  return at !== null && run.finishedAt !== null && parseTime(run.finishedAt).getTime() <= parseTime(at).getTime();
}

/**
 * The run's chain, boxes joined by arrows that wrap, one per row on a phone: the branch's runs that finished before it,
 * this run with its session, its handoff, the runs after it, then its later fixes.
 */
function Chain({ run }: { run: RunPageResponse }) {
  const { facts, session, handoffTo, related, context, laterFixes } = run;
  const other = (r: RunPageResponse['related'][number]) => (
    <ChainBox key={r.key}>
      <Link to="/runs/$key" params={{ key: r.key }} className={cn('font-semibold', LINK)}>
        {r.path ? `${pathLabel(r.path)} run` : 'Another run'}
      </Link>
      {r.finishedAt && (
        <Under>
          <Time iso={r.finishedAt} />
        </Under>
      )}
    </ChainBox>
  );
  const boxes = [
    ...related.filter((r) => before(r, facts.finishedAt)).map(other),
    <ChainBox key="this" current>
      <span className="font-semibold">{facts.path ? `This run, ${pathLabel(facts.path)!.toLowerCase()}` : 'This run'}</span>
      {session && (
        <Under>
          {`in session ${session.title} `}
          {session.sessionId && <SessionChip id={session.sessionId} />}
        </Under>
      )}
    </ChainBox>,
    (context?.handoff || handoffTo) && (
      <ChainBox key="handoff" dashed>
        <span className="font-semibold">{`Handed off to ${handoffTo?.title ?? 'a new session'}`}</span>
        {context?.handoff && (
          <Under>
            <Time iso={context.handoff} />
          </Under>
        )}
      </ChainBox>
    ),
    ...related.filter((r) => !before(r, facts.finishedAt)).map(other),
    laterFixes.length > 0 && (
      <ChainBox key="fixes" dashed>
        <span className="font-semibold">
          <LaterFixesTerm>{laterFixesLabel(laterFixes.length)}</LaterFixesTerm>
        </span>
      </ChainBox>
    ),
  ].filter(Boolean);
  return (
    <ol aria-label="Before and after this run" className="flex flex-col items-start gap-2 border-t pt-3 text-sm sm:flex-row sm:flex-wrap sm:items-center">
      {boxes.map((box, i) => (
        <li key={i} className="flex min-w-0 items-center gap-2">
          {i > 0 && <ArrowRight aria-hidden className="size-4 flex-none text-muted-foreground" />}
          {box}
        </li>
      ))}
    </ol>
  );
}

/** The run's facts, each a term over its value, then its chain. */
function Header({ run }: { run: RunPageResponse }) {
  const { facts } = run;
  const pairs: [string, ReactNode][] = [
    ['Project', <Text value={facts.project} />],
    ['Path', <Text value={pathLabel(facts.path)} />],
    ['Stage', <Text value={facts.stage} />],
    ['Time', <Num value={facts.minutes} format={formatMinutes} />],
    ['Est. cost', <Num value={facts.cost} format={formatCost} />],
    ['Tasks', <Num value={facts.tasks} />],
    ['Findings', <Num value={foundFindings(facts)} />],
    ['Closed', <Num value={closedFindings(facts)} />],
    ['Stops', <span className={cn(!!facts.stops && WARNING_INK)}><Num value={facts.stops} /></span>],
    ['Warnings', <Num value={facts.warnings} />],
  ];
  return (
    <Panel className="gap-3 py-3">
      <Pairs inline="over" className="gap-x-10 gap-y-3" pairs={pairs} />
      <Chain run={run} />
    </Panel>
  );
}

/**
 * One run: its branch and facts, the run drawn as a graph with its problems and the reviewers' strengths in two tables
 * that follow the selected step, and its skills, models, advisor notes, context and warnings for the run as a whole (decision 30).
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
  const units = unitsOf(stages);
  const unit = units.find((u) => u.id === selected);
  // The run's strengths are numbered in order, so a strength keeps its number when a step filters them.
  const numbered = strengths.map((strength, i) => ({ ...strength, id: `S${i + 1}` }));
  const problems = unit ? unit.findings : findings;
  const praised = unit ? strengthsOf(unit, numbered) : numbered;
  const where = unit ? ` in ${unit.name}` : '';
  // Before steps the counts aren't known, as the header's Findings dash says, so the titles carry none.
  const problemsTitle = (
    <TableTitle icon={<TriangleAlert aria-hidden className={cn('size-5', PROBLEMS_INK)} />} text={facts.beforeSteps ? 'Problems' : `Problems${where} (${problems.length})`} />
  );
  const strengthsTitle = (
    <TableTitle icon={<ThumbsUp aria-hidden className={cn('size-5', STRENGTHS_INK)} />} text={facts.beforeSteps ? 'Strengths' : `Strengths${where} (${praised.length})`} />
  );
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{facts.branch ?? 'Run'}</PageTitle>
      <Header run={run.data} />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
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
          {problems.length > 0 ? (
            <FindingsTable
              // Keyed by the selection, so a filter set on one step resets with it.
              key={unit?.id ?? 'run'}
              findings={problems}
              categoryLabels={categoryLabels}
              heading={problemsTitle}
              label="Problems table"
              skip={['step']}
              containerClassName={PROBLEMS_SIDE}
            />
          ) : (
            <NoneLine title={problemsTitle} side={PROBLEMS_SIDE}>
              {facts.beforeSteps
                ? 'Recorded before findings were logged: this run has none to list.'
                : unit
                  ? `${unit.name} found no problem.`
                  : 'The reviews found no problem in this run.'}
            </NoneLine>
          )}
          {praised.length > 0 ? (
            <Section title={strengthsTitle}>
              <StrengthsTable strengths={praised} categoryLabels={categoryLabels} />
            </Section>
          ) : (
            <NoneLine title={strengthsTitle} side={STRENGTHS_SIDE}>
              {facts.beforeSteps
                ? 'Recorded before strengths were logged: this run has none to list.'
                : unit
                  ? `The reviewers named no strength in ${unit.name}.`
                  : 'The reviewers named no strength in this run.'}
            </NoneLine>
          )}
          <LeftForLater
            // The units' own findings, so each names the unit holding it.
            findings={unit ? unit.findings : units.flatMap((u) => u.findings)}
            from={(f) => units.find((u) => u.findings.includes(f))?.name ?? null}
            laterFixes={run.data.laterFixes}
            step={unit?.name ?? null}
            beforeSteps={facts.beforeSteps}
          />
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
