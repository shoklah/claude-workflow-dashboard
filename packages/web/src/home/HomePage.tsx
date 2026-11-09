import type { HomeResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { Feed } from './Feed.tsx';
import { WeekTiles } from './WeekTiles.tsx';
import { WeeklyCharts } from './WeeklyCharts.tsx';
import { WorkflowDiagram } from './WorkflowDiagram.tsx';

/** The home screen (decision 22): the week's tiles, the workflow, the weekly charts, and the feed on the right. */
export function HomePage() {
  const home = useLiveQuery<HomeResponse>('/api/home');
  return (
    <>
      <h1 className="sr-only">Home</h1>
      {home.isPending && <p className="text-muted-foreground">Loading…</p>}
      {home.isError && <p>Can't load the home screen.</p>}
      {home.data && (
        <div className="flex gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <WeekTiles thisWeek={home.data.thisWeek} lastWeek={home.data.lastWeek} />
            <WorkflowDiagram diagram={home.data.diagram} />
            <WeeklyCharts charts={home.data.charts} coverageFrom={home.data.coverageFrom} />
          </div>
          <div className="w-64 flex-none border-l pl-3">
            <Feed items={home.data.feed} />
          </div>
        </div>
      )}
    </>
  );
}
