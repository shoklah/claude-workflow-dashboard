import type { ReactNode } from 'react';
import { Link, type LinkProps } from '@tanstack/react-router';
import { X } from 'lucide-react';

/** A filter set from a link (Compliance's step, the Sessions view's session): a pill naming it, beside the list's
 * filters, and a link to `to` with `search`, named `label`, that clears it. */
export function FilterChip({
  label,
  to,
  search,
  children,
}: {
  label: string;
  to: LinkProps['to'];
  search?: LinkProps['search'];
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-control border border-input px-3 py-1">
      {children}
      <Link to={to} search={search} aria-label={label} className="rounded-full hover:bg-accent">
        <X className="size-3.5" aria-hidden />
      </Link>
    </span>
  );
}
