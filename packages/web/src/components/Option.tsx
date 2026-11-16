import type { ReactNode } from 'react';
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
      className="rounded-control"
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
