import { useId, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from 'cn';
import { LINK } from './Panel.tsx';

/** A table row's toggle for its detail rows: a button with `aria-expanded`, its chevron, an optional mark `before`
 * the name (a swatch), and the name underlined as a link, with `className` on it. With a `link` (a goal's section), the
 * chevron alone is the button, named by the link, which sits beside it with `className`. */
export function RowToggle({
  open,
  onToggle,
  before,
  link,
  className,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  before?: ReactNode;
  link?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const linkId = useId();
  const Chevron = open ? ChevronDown : ChevronRight;
  const chevron = <Chevron aria-hidden className="size-4 flex-none text-muted-foreground" />;
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
  return (
    <button type="button" aria-expanded={open} onClick={onToggle} className="flex items-center gap-2 rounded-sm text-left">
      {chevron}
      {before}
      <span className={cn(LINK, className)}>{children}</span>
    </button>
  );
}
