import type { ReactNode } from 'react';
import { cn } from 'cn';
import { Button } from './ui/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.tsx';

/** One option of a switch, pressed while it is the switch's value; with a `disabledReason`, disabled, inside a
 * focusable span whose tooltip gives the reason. */
export function Option({
  pressed,
  onClick,
  children,
  disabledReason,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  disabledReason?: string;
}) {
  const button = (
    <Button
      size="sm"
      variant={pressed ? 'default' : 'outline'}
      aria-pressed={pressed}
      disabled={disabledReason !== undefined}
      onClick={onClick}
    >
      {children}
    </Button>
  );
  if (disabledReason === undefined) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>{button}</span>
      </TooltipTrigger>
      <TooltipContent>{disabledReason}</TooltipContent>
    </Tooltip>
  );
}

/** A switch: a group of `Option`s named `label`, which wraps; with `shown`, the label written first, as on the
 * backdrop. */
export function Options({
  label,
  shown = false,
  className,
  children,
}: {
  label: string;
  shown?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap items-center gap-1', className)}>
      {shown && <span className="mr-1">{label}</span>}
      {children}
    </div>
  );
}
