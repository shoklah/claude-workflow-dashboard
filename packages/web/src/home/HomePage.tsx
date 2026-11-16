import type { HomeResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { Feed } from './Feed.tsx';
import { SkillsAndCommands } from './SkillsAndCommands.tsx';
import { WeekTiles } from './WeekTiles.tsx';
import { WeeklyCharts } from './WeeklyCharts.tsx';
import { WorkflowDiagram } from './WorkflowDiagram.tsx';

/** The home screen (decision 22): the week's tiles, the workflow, the weekly charts, the skills and commands, and the feed on the right. */
export function HomePage() {
  const home = useLiveQuery<HomeResponse>('/api/home');
  return (
    <>
      <h1 className="sr-only">Home</h1>
      {home.isPending && <p className="text-muted-foreground">Loading…</p>}
      {home.isError && <p>Can't load the home screen.</p>}
      {home.data && (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <WeekTiles thisWeek={home.data.thisWeek} lastWeek={home.data.lastWeek} />
            <WorkflowDiagram diagram={home.data.diagram} />
            <WeeklyCharts charts={home.data.charts} coverageFrom={home.data.coverageFrom} />
            <SkillsAndCommands usage={home.data.usage} />
          </div>
          <div className="border-t pt-3 lg:w-64 lg:flex-none lg:border-t-0 lg:border-l lg:pt-0 lg:pl-3">
            <Feed items={home.data.feed} />
          </div>
        </div>
      )}
    </>
  );
}
