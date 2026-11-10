import { Link } from '@tanstack/react-router';

// The built pages only; the menu's later entries (decision 22) appear as their pages are built. An entry is current on
// its pages below it too (Runs on a run's page), except Home, which every path is below.
const ENTRIES = [
  { to: '/', label: 'Home', exact: true },
  { to: '/runs', label: 'Runs', exact: false },
  { to: '/findings', label: 'Findings', exact: false },
  { to: '/steps', label: 'Steps and rules', exact: false },
] as const;

export function Menu() {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1 text-sm">
      {ENTRIES.map((entry) => (
        <Link
          key={entry.to}
          to={entry.to}
          activeOptions={{ exact: entry.exact }}
          className="rounded-md px-2 py-1 hover:bg-accent"
          activeProps={{ className: 'font-semibold' }}
        >
          {entry.label}
        </Link>
      ))}
    </nav>
  );
}
