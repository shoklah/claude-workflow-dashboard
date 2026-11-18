import { useId, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from 'cn';
import { LINK } from './Panel.tsx';

/** A table row's toggle for its detail rows: a button with `aria-expanded`, its chevron, an optional mark `before`
 * the name (a swatch), both kept on the name's first line when it wraps, and the name underlined as a link, with
 * `className` on it. Without a name (`children`), it is the chevron alone: named by `label`, with `className` on the
 * button (the toggle before a cell that is a link), or, with a `link` (a goal's section), in primary ink (on the
 * backdrop), named by the link, which sits beside it with `className`. */
export function RowToggle({
  open,
  onToggle,
  before,
  label,
  link,
  className,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  before?: ReactNode;
  label?: string;
  link?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const linkId = useId();
  const Chevron = open ? ChevronDown : ChevronRight;
  // Beside a link the toggle heads a section on the backdrop, so its chevron takes primary ink.
  const chevron = <Chevron aria-hidden className={cn('size-4 flex-none', !link && 'text-muted-foreground')} />;
  if (link) {
    return (
      <span className="flex items-center gap-2">
        <button type="button" aria-expanded={open} aria-labelledby={linkId} onClick={onToggle} className="rounded-sm">
          {chevron}
        </button>
        {before}
        <span id={linkId} className={className}>
          {link}
        </span>
      </span>
    );
  }
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
