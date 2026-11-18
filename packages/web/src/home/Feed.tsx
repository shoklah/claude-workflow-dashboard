import { useQueryClient } from '@tanstack/react-query';
import { cn } from 'cn';
import { BrushCleaning } from 'lucide-react';
import type { FeedItem } from '@cwd/shared';
import { markSeen } from '../api.ts';
import { Button } from '../components/ui/button.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip.tsx';
import { Num } from '../components/Num.tsx';
import { Pairs, Panel } from '../components/Panel.tsx';
import { RunLink } from '../components/RunLink.tsx';
import { WarningText } from '../components/WarningText.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { formatCost, formatMinutes, pathLabel } from '../lib/format.ts';

/** An item: what happened and when, its status a swatch beside the word (the warning orange or the finished green);
 * then the run it concerns, its branch leading and opening the run, its project and path trailing, muted; then its
 * facts, a run's as labelled pairs, a warning's its text. */
function Item({ item }: { item: FeedItem }) {
  const warning = item.type === 'warning';
  const path = pathLabel(item.path);
  return (
    <li className="flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0">
      <div className="flex items-baseline gap-2">
        <span
          aria-hidden
          className={cn('size-2.5 flex-none translate-y-px rounded-swatch', warning ? 'bg-warning-edge' : 'bg-success-edge')}
        />
        <b className="font-semibold">{warning ? 'New warning' : 'Run finished'}</b>
        <span className="ml-auto text-xs text-muted-foreground">
          <Time iso={item.at} />
        </span>
      </div>
      {item.runKey !== null ? (
        <RunLink runKey={item.runKey} branch={item.branch} title={item.headline} className="break-words" />
      ) : (
        item.branch !== null && <span className="break-words">{item.branch}</span>
      )}
      {item.project !== null && (
        <span className="text-xs text-muted-foreground">
          {path === null ? item.project : `${item.project}, ${path} path`}
        </span>
      )}
      {warning ? (
        item.text !== null && <WarningText text={item.text} sessionId={item.sessionId} branch={item.branch} />
      ) : (
        <Pairs
          className="mt-1"
          pairs={[
            ['Findings', <Num value={item.findings?.total} />],
            ['Acted on', <Num value={item.findings?.actedOn} />],
            ['Open', <Num value={item.findings?.open} />],
            ['Time', <Num value={item.minutes} format={formatMinutes} />],
            ['Est. cost', <Num value={item.cost} format={formatCost} />],
          ]}
        />
      )}
    </li>
  );
}

/** What's new since the last look (finished runs, first-seen warnings), and "Mark all seen", an icon, to start again
 * from now: Home's side column, sticky from lg, its list scrolling in its own region. */
export function Feed({ items }: { items: FeedItem[] }) {
  const queryClient = useQueryClient();
  async function onMarkAllSeen() {
    await markSeen();
    await queryClient.invalidateQueries({ queryKey: ['/api/home'] });
  }
  return (
    <Panel
      title="Since you last looked"
      aside={
        items.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon-sm" className="ml-auto" aria-label="Mark all seen" onClick={onMarkAllSeen}>
                <BrushCleaning aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Mark all seen</TooltipContent>
          </Tooltip>
        )
      }
      className="text-sm lg:sticky lg:top-3 lg:max-h-[calc(100dvh-1.5rem)] lg:w-72 lg:flex-none"
    >
      {items.length === 0 ? (
        <p className="text-muted-foreground">Nothing new. Finished runs and new warnings show here until you mark them seen.</p>
      ) : (
        <div
          data-scroll-cue="block"
          tabIndex={0}
          role="region"
          aria-label="Since you last looked list"
          className="max-h-96 overflow-y-auto lg:max-h-none"
        >
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <Item key={`${item.type} ${item.at} ${item.runKey} ${item.text}`} item={item} />
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
