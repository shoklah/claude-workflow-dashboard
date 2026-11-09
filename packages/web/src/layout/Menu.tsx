import { Link } from '@tanstack/react-router';

// Slice 1's pages only; the menu's later entries (decision 22) appear as their pages are built.
const ENTRIES = [
  { to: '/', label: 'Home' },
  { to: '/runs', label: 'Runs' },
] as const;

export function Menu() {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1 text-sm">
      {ENTRIES.map((entry) => (
        <Link
          key={entry.to}
          to={entry.to}
          activeOptions={{ exact: true }}
          className="rounded-md px-2 py-1 hover:bg-accent"
          activeProps={{ className: 'font-semibold' }}
        >
          {entry.label}
        </Link>
      ))}
    </nav>
  );
}
