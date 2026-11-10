import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { cn } from 'cn';
import type { ComplianceResponse, FindingsQuery, RunsResponse, StepKind } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { HeatmapTable, type HeatmapGroup, type HeatmapSelection } from '../components/HeatmapTable.tsx';
import { WarningText } from '../components/WarningText.tsx';
import { Option } from '../findings/FindingsPage.tsx';
import {
  FAMILY_LABELS,
  STEP_LABELS,
  WARNING_INK,
  hiddenLabel,
  kindLabel,
  plural,
  runName,
  weekLabel,
} from '../lib/format.ts';
import { ListFilters, listPath } from '../runs/RunsPage.tsx';

/** The rows by family, each family's run of rows under its name, in the response's order. */
function groupsOf(rows: ComplianceResponse['rows']): HeatmapGroup[] {
  const groups: (HeatmapGroup & { family: string })[] = [];
  for (const row of rows) {
    if (groups.at(-1)?.family !== row.family) {
      groups.push({ family: row.family, heading: FAMILY_LABELS[row.family] ?? row.family, rows: [] });
    }
    groups.at(-1)!.rows.push({ key: kindLabel(row.kind), header: kindLabel(row.kind), values: row.cells });
  }
  return groups;
}

/**
 * The Compliance page: the period's warnings by kind and week, the kinds grouped by family, current ones or including
 * resolved; the selected cell's warnings below the grid. `step`, from the URL, keeps the warnings naming that step.
 */
export function CompliancePage({ step }: { step?: StepKind }) {
  const [query, setQuery] = useState<FindingsQuery>({ weeks: 4 });
  const [resolved, setResolved] = useState(false);
  const [selected, setSelected] = useState<HeatmapSelection | null>(null);
  const compliance = useLiveQuery<ComplianceResponse>(listPath('/api/compliance', { ...query, resolved, step }));
  // The project options: every project of the longest period.
  const runs = useLiveQuery<RunsResponse>(listPath('/api/runs', { weeks: 52 }));
  const data = compliance.data;
  const listed =
    data && selected
      ? data.warnings.filter((w) => kindLabel(w.kind) === selected.key && w.week === selected.week)
      : [];
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Compliance</h1>
      <ListFilters
        query={query}
        projects={runs.data?.projects}
        onChange={(change) => {
          setQuery({ ...query, ...change });
          setSelected(null);
        }}
      >
        <div role="group" aria-label="Current or resolved" className="flex gap-1">
          {[false, true].map((option) => (
            <Option
              key={String(option)}
              pressed={resolved === option}
              onClick={() => {
                setResolved(option);
                setSelected(null);
              }}
            >
              {option ? 'Including resolved' : 'Current warnings'}
            </Option>
          ))}
        </div>
        {step && (
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
            Step: {STEP_LABELS[step]}
            <Link to="/compliance" aria-label="Clear the step filter" className="rounded-full hover:bg-accent">
              <X className="size-3.5" aria-hidden />
            </Link>
          </span>
        )}
      </ListFilters>
      {compliance.isPending && <p className="text-sm text-muted-foreground">Loading the warnings…</p>}
      {compliance.isError && <p className="text-sm">Couldn't load the warnings.</p>}
      {data &&
        (data.rows.length === 0 ? (
          <p className="text-sm">No warnings in this period.</p>
        ) : (
          <HeatmapTable
            label="Warnings by kind and week"
            corner="Kind"
            weeks={data.weeks}
            groups={groupsOf(data.rows)}
            max={Math.max(0, ...data.rows.flatMap((row) => row.cells))}
            selected={selected}
            onSelect={setSelected}
          />
        ))}
      {data && data.rows.length > 0 && selected && (
        <>
          <h2 className="font-semibold">
            {`${selected.key} · week of ${weekLabel(selected.week)} · ${plural(listed.length, 'warning')}`}
          </h2>
          <ul aria-label="Warnings" className="flex flex-col gap-2 text-sm">
            {listed.map((w) => (
              <li key={`${w.runKey} ${w.sessionId} ${w.text}`} className="border-l-3 border-amber-600 py-0.5 pl-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-sm border px-1 text-xs text-muted-foreground">{kindLabel(w.kind)}</span>
                  {w.runKey !== null && (
                    <Link to="/runs/$key" params={{ key: w.runKey }} className="underline-offset-2 hover:underline">
                      {runName(w)}
                    </Link>
                  )}
                  {w.isNew && <span className={cn('text-xs', WARNING_INK)}>new</span>}
                </div>
                <div>
                  <WarningText text={w.text} sessionId={w.sessionId} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {data && data.rows.length > 0 && !selected && (
        <p className="text-sm text-muted-foreground">Select a cell to list its warnings.</p>
      )}
      {data && data.hidden > 0 && <p className="text-sm text-muted-foreground">{hiddenLabel(data.hidden, 'warning')}</p>}
    </div>
  );
}
