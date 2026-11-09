import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ShowingResponse } from '@cwd/shared';
import { showProjects, useLiveQuery } from '../api.ts';
import { Button } from '../components/ui/button.tsx';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.tsx';
import { Switch } from '../components/ui/switch.tsx';

/** Showing mode: while off, a switch that opens the project picker; while on, an orange bar naming what it shows. */
export function ShowingControl() {
  const showing = useLiveQuery<ShowingResponse>('/api/showing');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  // The server filters every response by the mode, so every page's data is read again.
  async function show(projects: string[]) {
    await showProjects(projects);
    setOpen(false);
    await queryClient.invalidateQueries();
  }

  if (showing.isError) return <p className="text-sm">Couldn't read showing mode.</p>;
  if (showing.data?.on) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-orange-500 bg-orange-50 px-3 py-1 text-sm text-orange-950">
        <b>Showing: {showing.data.projects.map((project) => project.name).join(', ')}</b>
        <Button variant="outline" size="sm" onClick={() => show([])}>
          Stop showing
        </Button>
      </div>
    );
  }
  return (
    <>
      <label className="flex items-center gap-2 py-1.5 text-sm">
        <Switch checked={open} disabled={!showing.data} onCheckedChange={setOpen} />
        Showing mode
      </label>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Show which projects in full?</DialogTitle>
            <DialogDescription>
              The projects you pick show under their alias, with their runs, findings and costs. Every other project
              counts only in totals and charts. Paths and session IDs are never sent while this is on.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1 text-sm">
            {showing.data?.projects.map((project) => (
              <label key={project.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={picked.includes(project.key)}
                  onChange={(e) =>
                    setPicked(e.target.checked ? [...picked, project.key] : picked.filter((key) => key !== project.key))
                  }
                />
                {project.name}
              </label>
            ))}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button disabled={picked.length === 0} onClick={() => show(picked)}>
              Start showing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
