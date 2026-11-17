import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from 'cn';
import { LINK } from './Panel.tsx';

/** A table row's toggle for its detail rows: a button with `aria-expanded`, its chevron, an optional mark `before`
 * the name (a swatch), and the name underlined as a link, with `className` on it. */
export function RowToggle({
  open,
  onToggle,
  before,
  className,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  before?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <button type="button" aria-expanded={open} onClick={onToggle} className="flex items-center gap-2 rounded-sm text-left">
      <Chevron aria-hidden className="size-4 flex-none text-muted-foreground" />
      {before}
      <span className={cn(LINK, className)}>{children}</span>
    </button>
  );
}
