import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Menu as MenuIcon } from 'lucide-react';
import { Button } from '../components/ui/button.tsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog.tsx';

// The built pages only; the menu's later entries (decision 22) appear as their pages are built. An entry is current on
// its pages below it too (Runs on a run's page), except Home, which every path is below.
const ENTRIES = [
  { to: '/', label: 'Home', exact: true },
  { to: '/runs', label: 'Runs', exact: false },
  { to: '/findings', label: 'Findings', exact: false },
  { to: '/sessions', label: 'Sessions', exact: false },
  { to: '/context', label: 'Context', exact: false },
  { to: '/compliance', label: 'Compliance', exact: false },
  { to: '/steps', label: 'Steps and rules', exact: false },
  { to: '/skills', label: 'Skills', exact: false },
  { to: '/models', label: 'Models and advisor', exact: false },
  { to: '/spend', label: 'Spend', exact: false },
  { to: '/weeks', label: 'Weeks', exact: false },
] as const;

/** The pages' links, one under the other; `onNavigate` runs when one is followed. */
export function Menu({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1 text-sm">
      {ENTRIES.map((entry) => (
        <Link
          key={entry.to}
          to={entry.to}
          onClick={onNavigate}
          activeOptions={{ exact: entry.exact }}
          className="rounded-control px-3 py-1 hover:bg-accent"
          activeProps={{ className: 'bg-accent font-semibold' }}
        >
          {entry.label}
        </Link>
      ))}
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
      <DialogContent className="top-2 left-2 max-w-64 translate-x-0 translate-y-0 rounded-panel border-panel-edge bg-popover p-4 text-popover-foreground sm:max-w-64">
        <DialogHeader>
          <DialogTitle className="text-section-title">Pages</DialogTitle>
          <DialogDescription className="sr-only">Go to a page of the dashboard.</DialogDescription>
        </DialogHeader>
        <Menu onNavigate={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
