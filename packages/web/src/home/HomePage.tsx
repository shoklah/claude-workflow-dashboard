import type { HomeResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { PageTitle, State } from '../components/Panel.tsx';
import { Feed } from './Feed.tsx';
import { SkillsAndCommands } from './SkillsAndCommands.tsx';
import { WeekTiles } from './WeekTiles.tsx';
import { WeeklyCharts } from './WeeklyCharts.tsx';
import { WorkflowDiagram } from './WorkflowDiagram.tsx';

/** The home screen (decision 22): the week's tiles, the workflow, the weekly charts, the skills and commands, and the feed on the right. */
export function HomePage() {
  const home = useLiveQuery<HomeResponse>('/api/home');
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Home</PageTitle>
      {home.isPending && <State>Loading the home screen…</State>}
      {home.isError && <State error>Can't load the home screen.</State>}
      {home.data && (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <WeekTiles thisWeek={home.data.thisWeek} lastWeek={home.data.lastWeek} />
            <WorkflowDiagram diagram={home.data.diagram} />
            <WeeklyCharts charts={home.data.charts} coverageFrom={home.data.coverageFrom} />
            <SkillsAndCommands usage={home.data.usage} />
          </div>
          <div className="lg:w-72 lg:flex-none">
            <Feed items={home.data.feed} />
          </div>
        </div>
      )}
    </div>
  );
}
