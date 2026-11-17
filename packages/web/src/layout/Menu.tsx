import { useId, useState } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import type { LinkProps } from '@tanstack/react-router';
import {
  Bot, CalendarDays, CircleDollarSign, Gauge, House, Layers, ListChecks, Menu as MenuIcon, Puzzle, SearchCheck,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '../components/ui/button.tsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog.tsx';
import { Brand } from './Brand.tsx';

type Entry = { to: LinkProps['to']; label: string; icon: LucideIcon; exact?: boolean; also?: string[] };

// The one list of pages, in sections: Home and Weeks first, unnamed, then a named section per kind of page. An entry
// is current on its pages below it too (Work on a goal's page), except Home, which every path is below, and on the
// paths starting with one of its `also` prefixes (Work on a run's page). An icon is a picture of its page's subject and
// never changes with state.
const SECTIONS: { name: string | null; entries: Entry[] }[] = [
  { name: null, entries: [
    { to: '/', label: 'Home', icon: House, exact: true },
    { to: '/weeks', label: 'Weeks', icon: CalendarDays },
  ] },
  { name: 'Activity', entries: [
    { to: '/work', label: 'Work', icon: Layers, also: ['/runs/'] },
    { to: '/findings', label: 'Findings', icon: SearchCheck },
  ] },
  { name: 'Usage and cost', entries: [
    { to: '/context', label: 'Context', icon: Gauge },
    { to: '/spend', label: 'Spend', icon: CircleDollarSign },
  ] },
  { name: 'Workflow', entries: [
    { to: '/compliance', label: 'Compliance', icon: ShieldCheck },
    { to: '/steps', label: 'Steps and rules', icon: ListChecks },
    { to: '/skills', label: 'Skills', icon: Puzzle },
    { to: '/models', label: 'Models and advisor', icon: Bot },
  ] },
];

/** The current entry's look. */
const CURRENT = 'bg-accent font-semibold';

/** The pages' links in their sections; `onNavigate` runs when one is followed. */
export function Menu({ onNavigate }: { onNavigate?: () => void }) {
  // The rail and the dialog both render the menu, so a section's name gets its id per instance.
  const id = useId();
  const pathname = useLocation({ select: (location) => location.pathname });
  return (
    <nav aria-label="Main" className="flex flex-col gap-6 text-sm">
      {SECTIONS.map((section, i) => {
        const nameId = `${id}-${i}`;
        const named = section.name ? { role: 'group', 'aria-labelledby': nameId } : {};
        return (
          <div key={section.name ?? ''} {...named} className="flex flex-col gap-1">
            {section.name && <div id={nameId} className="px-3 pb-1 text-xs font-medium text-muted-foreground">{section.name}</div>}
            {section.entries.map((entry) => {
              const also = entry.also?.some((prefix) => pathname.startsWith(prefix));
              return (
                <Link
                  key={entry.to}
                  to={entry.to}
                  onClick={onNavigate}
                  activeOptions={{ exact: entry.exact }}
                  className={cn('flex items-center gap-2.5 rounded-control px-3 py-1.5 hover:bg-accent', also && CURRENT)}
                  activeProps={{ className: CURRENT }}
                  aria-current={also ? 'page' : undefined}
                >
                  <entry.icon className="size-4 flex-none" aria-hidden />
                  {entry.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

/** The menu under 768 px: one button in the header row that opens the pages' links in a dialog, closed by following one. */
export function MenuButton() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="md:hidden">
          <MenuIcon aria-hidden />
          Menu
        </Button>
      </DialogTrigger>
      <DialogContent className="top-2 left-2 max-h-[calc(100dvh-1rem)] max-w-64 translate-x-0 translate-y-0 overflow-y-auto rounded-panel border-panel-edge bg-popover p-4 text-popover-foreground sm:max-w-64">
        <DialogHeader className="text-left">
          <DialogTitle className="sr-only">Pages</DialogTitle>
          <Brand />
          <DialogDescription className="sr-only">Go to a page of the dashboard.</DialogDescription>
        </DialogHeader>
        <Menu onNavigate={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
