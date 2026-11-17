import { useState } from 'react';
import { AREAS, type Area, type FindingsQuery, type FindingsResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { Option, Options } from '../components/Option.tsx';
import { Line, PageTitle, Section, State } from '../components/Panel.tsx';
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
    <div className="flex flex-col gap-4">
      <PageTitle>Findings</PageTitle>
      <ListFilters
        query={query}
        projects={projects}
        onChange={(change) => {
          setQuery({ ...query, ...change });
          setSelected(null);
        }}
      />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <Options label="Measure" shown>
          {MEASURES.map((option) => (
            <Option key={option.measure} pressed={measure === option.measure} onClick={() => setMeasure(option.measure)}>
              {option.label}
            </Option>
          ))}
        </Options>
        <Options label="Area" shown>
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
        </Options>
      </div>
      {findings.isPending && <State>Loading the findings…</State>}
      {findings.isError && (
        <State error>Couldn't load the findings. Check that the dashboard server is running, then refresh.</State>
      )}
      {data && (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <FindingsGrid response={data} measure={measure} area={area} selected={selected} onSelect={setSelected} />
            {!workflowLabelled(data) && <Line>Every label here is the app's, until the workflow labels findings itself.</Line>}
            {data.rows.every((row) => row.cells.every((c) => c.raised === 0)) ? (
              <Line>No findings in this period. A finding shows here once a run with a review is imported.</Line>
            ) : selected ? (
              <Section
                title={`${plural(listed.length, 'finding')} in ${categoryLabel(selected.category, data.categoryLabels)}, week of ${weekLabel(selected.week)}`}
              >
                <FindingsTable findings={listed} categoryLabels={data.categoryLabels} run />
              </Section>
            ) : (
              <Line>Select a cell to list its findings.</Line>
            )}
            {data.hidden > 0 && <Line>{hiddenLabel(data.hidden, 'finding')}</Line>}
          </div>
          <div className="lg:w-80 lg:flex-none">
            <SignalsPanel signals={data.signals} labeller={data.labeller} />
          </div>
        </div>
      )}
    </div>
  );
}
