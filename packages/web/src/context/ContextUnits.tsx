import type { ReactNode } from 'react';
import { cn } from 'cn';
import { parseTime, type ContextUnit } from '@cwd/shared';
import { DataList, type ListColumn, type ListFact } from '../components/DataList.tsx';
import { Num, Unknown } from '../components/Num.tsx';
import { Line, Section } from '../components/Panel.tsx';
import { RunLink, runName } from '../components/RunLink.tsx';
import { SessionChip } from '../components/SessionChip.tsx';
import { ShareBar } from '../components/ShareBar.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import {
  WARNING_INK,
  capitalize,
  formatCompactFixed,
  hiddenLabel,
  projectLabel,
  sessionName,
} from '../lib/format.ts';

/** A session's name as plain text (its row's toggle; its ID stays off the row), null for a run, whose name is its link. */
const sessionText = (u: ContextUnit) => (u.run ? null : sessionName(u.session?.title ?? null));

/** The first glance: which ran past the cap; Kind, When, Largest and Read share fold into the opened row when narrow. */
const COLUMNS: ListColumn<ContextUnit>[] = [
  {
    id: 'name',
    header: 'Name',
    wide: true,
    value: (u) => (u.run ? u.run.branch : (u.session?.title ?? null)),
    cell: (u) => (u.run ? <RunLink runKey={u.run.key} branch={u.run.branch} /> : sessionText(u)),
    text: sessionText,
  },
  { id: 'kind', header: 'Kind', fold: true, value: (u) => u.kind, cell: (u) => capitalize(u.kind) },
  {
    id: 'when',
    header: 'When',
    fold: true,
    value: (u) => (u.at === null ? null : parseTime(u.at).getTime()),
    cell: (u) => (u.at === null ? <Unknown /> : <Time iso={u.at} />),
  },
  {
    id: 'over',
    header: 'Past the cap',
    num: true,
    value: (u) => u.callsOverCap,
    cell: (u) => (
      <span className={cn(u.callsOverCap > 0 && WARNING_INK)}>
        <Num value={u.callsOverCap} />
      </span>
    ),
  },
  {
    id: 'largest',
    header: 'Largest',
    num: true,
    fold: true,
    value: (u) => u.maxTokens,
    cell: (u) => <Num value={u.maxTokens} format={formatCompactFixed} />,
  },
  { id: 'read', header: 'Read share', fold: true, value: (u) => u.readShare, cell: (u) => <ShareBar share={u.readShare} /> },
];

/** The opened row's facts, one not known (a handoff when there is none) left out. */
const FACTS: ListFact<ContextUnit>[] = [
  ['Project', (u) => (u.run ? u.run.project : projectLabel(u.session?.project ?? null))],
  ['Calls', (u) => <Num value={u.calls} />],
  ['Median tokens per call', (u) => (u.medianTokens === null ? null : <Num value={u.medianTokens} format={formatCompactFixed} />)],
  ['Handed off', (u) => (u.handoff === null ? null : <Time iso={u.handoff} />)],
  ['To session', (u) => (u.handedOffTo === null ? null : sessionName(u.handedOffTo.title))],
  ['Its ID', (u) => (u.handedOffTo?.sessionId ? <SessionChip id={u.handedOffTo.sessionId} /> : null)],
  ['Sweeps inline', (u) => <Num value={u.sweeps.inline} />],
  ['Sweeps delegated', (u) => <Num value={u.sweeps.delegated} />],
];

/**
 * The Context page's runs and sessions, in the API's order (most calls past the cap first): over the cap only, or all
 * with a context, by the switch beside its title (`children`); a line under them counts those of other projects while
 * showing.
 */
export function ContextUnits({
  units,
  hidden,
  over,
  children,
}: {
  units: ContextUnit[];
  hidden: number;
  over: boolean;
  children?: ReactNode;
}) {
  return (
    <Section title="Runs and sessions" aside={children}>
      <DataList
        rows={units}
        rowKey={(u) => u.key}
        name={(u) => (u.run ? runName(u.run.branch) : sessionName(u.session?.title ?? null))}
        columns={COLUMNS}
        facts={FACTS}
        label="Runs and sessions table"
        empty={over ? 'No runs or sessions past the cap in this period.' : 'No runs or sessions with context in this period.'}
      />
      {hidden > 0 && <Line>{hiddenLabel(hidden, 'row')}</Line>}
    </Section>
  );
}
