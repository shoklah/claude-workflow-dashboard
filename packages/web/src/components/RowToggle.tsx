import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from 'cn';
import { LINK } from './Panel.tsx';

/** A table row's toggle for its detail rows: a button with `aria-expanded`, its chevron, an optional mark `before`
 * the name (a swatch), both kept on the name's first line when it wraps, and the name underlined as a link, with
 * `className` on it. Without a name (`children`), it is the chevron alone, named by `label`, with `className` on the
 * button: the toggle before a cell that is a link. */
export function RowToggle({
  open,
  onToggle,
  before,
  label,
  className,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  before?: ReactNode;
  label?: string;
  className?: string;
  children?: ReactNode;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;
  const chevron = <Chevron aria-hidden className="size-4 flex-none text-muted-foreground" />;
  if (children === undefined)
    return (
      <button type="button" aria-expanded={open} aria-label={label} onClick={onToggle} className={cn('rounded-sm', className)}>
        {chevron}
      </button>
    );
  return (
    <button type="button" aria-expanded={open} onClick={onToggle} className="flex items-start gap-2 rounded-sm text-left">
      <span className="flex h-5 flex-none items-center gap-2">
        {chevron}
        {before}
      </span>
      <span className={cn(LINK, className)}>{children}</span>
    </button>
  );
}
