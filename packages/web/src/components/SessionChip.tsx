import { useState } from 'react';
import { Copy } from 'lucide-react';
import { cn } from 'cn';
import { Button } from './ui/button.tsx';
import { TERM } from './Panel.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.tsx';

/**
 * A session by its name, with its full ID in a tooltip on hover and focus and a button that copies it (decision 31).
 * The name is the ID's first 8 characters until the reporter gives sessions a title (CR9). `copy={false}` leaves the
 * button out.
 */
export function SessionChip({ id, copy = true }: { id: string; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copyId() {
    await navigator.clipboard.writeText(id);
    setCopied(true);
  }
  return (
    <span className="inline-flex items-center gap-0.5 align-baseline">
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className={cn('rounded tabular-nums', TERM)}>
            {id.slice(0, 8)}
          </span>
        </TooltipTrigger>
        <TooltipContent className="font-mono">{id}</TooltipContent>
      </Tooltip>
      {copy && (
        <>
          <Button variant="ghost" size="icon-xs" aria-label="Copy session ID" onClick={copyId}>
            <Copy aria-hidden />
          </Button>
          <span aria-live="polite" className="text-xs text-muted-foreground">
            {copied && 'Copied'}
          </span>
        </>
      )}
    </span>
  );
}
