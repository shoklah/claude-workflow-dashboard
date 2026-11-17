import { useState, type ReactNode } from 'react';
import { ArrowRight, ThumbsUp, TriangleAlert } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import { parseTime, type RunPageResponse } from '@cwd/shared';
import { ApiError, useLiveQuery } from '../api.ts';
import { Lines, NUM, Num, PairCells, Text } from '../components/Num.tsx';
import { Details, LINK, PageTitle, Pairs, Panel, Section, State } from '../components/Panel.tsx';
import { SessionChip } from '../components/SessionChip.tsx';
import { TableCell } from '../components/ui/table.tsx';
import { WarningText } from '../components/WarningText.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { FindingsTable } from './FindingsTable.tsx';
import { LaterFixesTerm, LeftForLater } from './LeftForLater.tsx';
import { stagesOf, strengthsOf, unitsOf } from './flow.ts';
import { RunFlow } from './RunFlow.tsx';
import { StepDetail } from './StepDetail.tsx';
import { StrengthsTable } from './StrengthsTable.tsx';
import {
  capitalize,
  closedFindings,
  countName,
  formatCompact,
  formatCost,
  formatMinutes,
  formatShare,
  foundFindings,
  laterFixesLabel,
  modelLabel,
  pairsOf,
  pathLabel,
  phaseLabel,
  PROBLEMS_INK,
  PROBLEMS_SIDE,
  STRENGTHS_INK,
  STRENGTHS_SIDE,
  WARNING_INK,
} from '../lib/format.ts';

/** A fold panel's line when it has nothing to show. */
function NoneText({ children }: { children: string }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** A plain table's column head; `num` for a numeric column. */
function Head({ num = false, children }: { num?: boolean; children: string }) {
  return (
    <th scope="col" className={cn('px-2 py-1.5 text-left font-medium text-muted-foreground', num && NUM)}>
      {children}
    </th>
  );
}

/** The main session's model and effort, each model's cost, the agents with each model and effort they ran on, and
 * the advisor's calls and notes. */
function ModelsAndAdvisor({ run }: { run: RunPageResponse }) {
  const { main, models, agents, advisor } = run;
  return (
    <Panel title="Models and advisor">
      {!main && models.length === 0 && agents.length === 0 && <NoneText>No model recorded.</NoneText>}
      {main && (
        <Pairs
          pairs={[
            ['Main session model', <Text value={modelLabel(main.model)} />],
            ['Main session effort', <Text value={main.effort} />],
          ]}
        />
      )}
      {models.length > 0 && <Pairs names pairs={models.map((model) => [<Text value={modelLabel(model.model)} />, formatCost(model.cost)])} />}
      {agents.length > 0 && (
        <div data-scroll-cue className="overflow-x-auto" tabIndex={0} role="region" aria-label="Agents table">
          <table aria-label="Agents" className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <Head>Agent</Head>
                <Head>Model</Head>
                <Head>Effort</Head>
                <Head num>Dispatches</Head>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => {
                const actual = pairsOf(agent.actual);
                return (
                  <Lines
                    key={agent.name}
                    name={agent.name}
                    lines={Math.max(1, actual.length)}
                    line={(i) => <PairCells pairs={actual} line={i} unset="not known" none="No dispatches" />}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {advisor ? (
        <Pairs
          pairs={[
            ['Advisor calls', <Num value={advisor.calls} />],
            ['Advisor notes', <Num value={advisor.notes} />],
          ]}
        />
      ) : (
        <NoneText>Advisor not consulted.</NoneText>
      )}
    </Panel>
  );
}

/** The run's cost, models, context and skills, folded: four panels, in two columns on a wide screen. */
function Fold({ run }: { run: RunPageResponse }) {
  const { phases, context, skills, offers } = run;
  return (
    <Details summary="Cost, context and skills">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Est. cost by phase">
          {phases.length > 0 ? (
            <Pairs pairs={phases.map((phase) => [phaseLabel(phase.name), <Num value={phase.cost} format={formatCost} />])} />
          ) : (
            <NoneText>No cost by phase recorded.</NoneText>
          )}
        </Panel>
        <ModelsAndAdvisor run={run} />
        <Panel title="Context">
          {context ? (
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
          ) : (
            <NoneText>No context facts for this run.</NoneText>
          )}
        </Panel>
        <Panel title="Skills">
          {skills.length + offers.length > 0 ? (
            <div data-scroll-cue className="overflow-x-auto" tabIndex={0} role="region" aria-label="Skills table">
              <table aria-label="Skills" className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <Head>Skill</Head>
                    <Head>Loaded or offered</Head>
                    <Head>Outcome</Head>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...skills.map((skill) => [skill.name, 'Loaded', capitalize(skill.outcome)]),
                    ...offers.map((offer) => [offer.skill, 'Offered', countName(offer.outcome)]),
                  ].map(([name, use, outcome], i) => (
                    <Lines
                      key={i}
                      name={name}
                      lines={1}
                      line={() => (
                        <>
                          <TableCell className="text-muted-foreground">{use}</TableCell>
                          <TableCell className="text-muted-foreground">{outcome}</TableCell>
                        </>
                      )}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <NoneText>No skill loaded or offered.</NoneText>
          )}
        </Panel>
      </div>
    </Details>
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
 * that follow the selected step, what it left for later, its warnings, and its cost, models, context and skills folded.
 * A key no shown run has gets its own message.
 */
export function RunPage({ runKey }: { runKey: string }) {
  const run = useLiveQuery<RunPageResponse>(`/api/runs/${encodeURIComponent(runKey)}`);
  // The selection holds its run's key: unit ids repeat across runs, and the route keeps this page when only the key changes.
  const [selection, setSelection] = useState<{ runKey: string; unit: string } | null>(null);
  const selected = selection?.runKey === runKey ? selection.unit : null;
  const select = (unit: string | null) => setSelection(unit === null ? null : { runKey, unit });
  if (run.isPending) return <State>Loading the run…</State>;
  if (run.error instanceof ApiError && run.error.status === 404) {
    return (
      <State error>
        {'No run with this key. '}
        <Link to="/runs" className={LINK}>
          Runs
        </Link>
      </State>
    );
  }
  if (run.isError) return <State error>Couldn't load this run.</State>;
  const { facts, timeline, findings, strengths, warnings, categoryLabels } = run.data;
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
      <div className="flex min-w-0 flex-col gap-6">
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
        {warnings.length > 0 && (
          <Panel title="Warnings">
            <ul className="flex flex-col gap-2 text-sm">
              {warnings.map((warning, i) => (
                <li key={i} className="flex flex-col gap-0.5">
                  <WarningText text={warning.text} sessionId={warning.sessionId} branch={facts.branch} />
                </li>
              ))}
            </ul>
          </Panel>
        )}
        <Fold run={run.data} />
      </div>
    </div>
  );
}
