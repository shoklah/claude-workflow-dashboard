import { useState, type ReactNode } from 'react';
import { AREAS, type Area, type FindingsQuery, type FindingsResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { Button } from '../components/ui/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip.tsx';
import { AREA_LABELS, categoryLabel, hiddenLabel, plural, weekLabel } from '../lib/format.ts';
import { FindingsTable } from '../runs/FindingsTable.tsx';
import { ListFilters, listPath, useProjects } from '../runs/RunsPage.tsx';
import { FindingsGrid, workflowLabelled, type Measure, type Selection } from './FindingsGrid.tsx';
import { SignalsPanel } from './SignalsPanel.tsx';

const MEASURES: { measure: Measure; label: string }[] = [
  { measure: 'raised', label: 'Raised' },
  { measure: 'actedOn', label: 'Share acted on' },
  { measure: 'invalid', label: 'Share judged invalid' },
  { measure: 'appDiffers', label: 'App differs' },
  { measure: 'strengths', label: 'Strengths' },
];

/** One option of a switch, pressed while it is the switch's value; with a `disabledReason`, disabled, inside a
 * focusable span whose tooltip gives the reason. */
export function Option({
  pressed,
  onClick,
  children,
  disabledReason,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  disabledReason?: string;
}) {
  const button = (
    <Button
      size="sm"
      variant={pressed ? 'default' : 'outline'}
      aria-pressed={pressed}
      disabled={disabledReason !== undefined}
      onClick={onClick}
    >
      {children}
    </Button>
  );
  if (disabledReason === undefined) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>{button}</span>
      </TooltipTrigger>
      <TooltipContent>{disabledReason}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The Findings page (layout B): the period's findings by category and week for one area under one measure, the
 * selected cell's findings below the grid, and the relevance signals beside it; a line says every label is the app's
 * while no finding of the period shows the workflow's.
 */
export function FindingsPage() {
  const [query, setQuery] = useState<FindingsQuery>({ weeks: 4 });
  const [measure, setMeasure] = useState<Measure>('raised');
  const [area, setArea] = useState<Area>('implementation');
  const [selected, setSelected] = useState<Selection | null>(null);
  const findings = useLiveQuery<FindingsResponse>(listPath('/api/findings', query));
  const projects = useProjects();
  const data = findings.data;
  const listed =
    data && selected
      ? data.findings.filter((f) => f.area === area && f.category === selected.category && f.week === selected.week)
      : [];
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Findings</h1>
      <ListFilters
        query={query}
        projects={projects}
        onChange={(change) => {
          setQuery({ ...query, ...change });
          setSelected(null);
        }}
      />
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div role="group" aria-label="Measure" className="flex gap-1">
          {MEASURES.map((option) => (
            <Option key={option.measure} pressed={measure === option.measure} onClick={() => setMeasure(option.measure)}>
              {option.label}
            </Option>
          ))}
        </div>
        <div role="group" aria-label="Area" className="flex gap-1">
          {AREAS.map((option) => (
            <Option
              key={option}
              pressed={area === option}
              onClick={() => {
                setArea(option);
                setSelected(null);
              }}
            >
              {AREA_LABELS[option]}
            </Option>
          ))}
        </div>
      </div>
      {findings.isPending && <p className="text-sm text-muted-foreground">Loading the findings…</p>}
      {findings.isError && <p className="text-sm">Couldn't load the findings.</p>}
      {data && (
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {!workflowLabelled(data) && (
              <p className="text-sm text-muted-foreground">
                Every label here is the app's, until the workflow labels findings itself.
              </p>
            )}
            <FindingsGrid response={data} measure={measure} area={area} selected={selected} onSelect={setSelected} />
            {data.rows.every((row) => row.cells.every((c) => c.raised === 0)) && (
              <p className="text-sm">No findings in this period.</p>
            )}
            {selected ? (
              <>
                <h2 className="font-semibold">
                  {`${categoryLabel(selected.category, data.categoryLabels)} · week of ${weekLabel(selected.week)} · ${plural(listed.length, 'finding')}`}
                </h2>
                <FindingsTable findings={listed} categoryLabels={data.categoryLabels} run />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a cell to list its findings.</p>
            )}
            {data.hidden > 0 && <p className="text-sm text-muted-foreground">{hiddenLabel(data.hidden, 'finding')}</p>}
          </div>
          <div className="w-72">
            <SignalsPanel signals={data.signals} labeller={data.labeller} />
          </div>
        </div>
      )}
    </div>
  );
}
