import { useState } from 'react';
import type { ShowingResponse } from '@cwd/shared';
import { saveShownProjects, useLiveQuery } from '../api.ts';
import { Line, Panel, State } from '../components/Panel.tsx';
import { Button } from '../components/ui/button.tsx';
import { ProjectPicks } from '../layout/ShowingControl.tsx';
import { useSend } from './send.ts';

/**
 * The projects the account shows, to its viewers and in showing mode: showing mode's projects, ticked from its kept
 * list, and Save, which keeps the ticked ones without turning showing mode on.
 */
export function ShownProjectsPanel() {
  const showing = useLiveQuery<ShowingResponse>('/api/showing');
  const [ticked, setTicked] = useState<string[] | null>(null);
  // While showing mode is on the kept list is what every page shows, so every page's cached data is dropped and read
  // again, as showing mode's own switch does; while off, only the list is read again.
  const { pending, failed, send } = useSend((client) =>
    showing.data?.on ? client.resetQueries() : client.invalidateQueries({ queryKey: ['/api/showing'] }),
  );
  const projects = showing.data?.projects ?? [];
  const picked = ticked ?? projects.filter((project) => project.picked).map((project) => project.key);

  return (
    <Panel title="Shown projects">
      {showing.isPending && <State>Loading your projects…</State>}
      {showing.isError && <State error>Couldn't load your projects. Reload the page to try again.</State>}
      {showing.data &&
        (projects.length === 0 ? (
          <Line muted>No projects yet.</Line>
        ) : (
          <>
            <ProjectPicks projects={projects} picked={picked} onChange={setTicked} />
            <div>
              <Button
                disabled={pending}
                onClick={() => send(() => saveShownProjects(picked), "Couldn't save the shown projects. Try again.")}
              >
                Save
              </Button>
            </div>
          </>
        ))}
      {failed && <State error>{failed}</State>}
    </Panel>
  );
}
