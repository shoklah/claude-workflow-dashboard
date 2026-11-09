import { useQueryClient } from '@tanstack/react-query';
import type { FeedItem } from '@cwd/shared';
import { markSeen } from '../api.ts';
import { Button } from '../components/ui/button.tsx';
import { WarningText } from '../components/WarningText.tsx';
import { actedOnSplit, formatCost, formatMinutes, joined, plural, runName } from '../lib/format.ts';

function Item({ item }: { item: FeedItem }) {
  const where = joined([runName(item), item.path]);
  if (item.type === 'warning') {
    return (
      <li className="border-l-3 border-amber-600 py-0.5 pl-2">
        <b>New warning</b>
        {where && ` · ${where}`}
        <div>{item.text !== null && <WarningText text={item.text} sessionId={item.sessionId} />}</div>
      </li>
    );
  }
  const findings = item.findings && `${plural(item.findings.total, 'finding')} · ${actedOnSplit(item.findings)}`;
  return (
    <li className="border-l-3 border-green-700 py-0.5 pl-2">
      <b>Run finished</b>
      {where && ` · ${where}`}
      <div>
        {joined([
          findings,
          item.minutes === null ? null : formatMinutes(item.minutes),
          item.cost === null ? null : formatCost(item.cost),
        ])}
      </div>
    </li>
  );
}

/** What's new since the last look (finished runs, first-seen warnings), and "Mark all seen" to start again from now. */
export function Feed({ items }: { items: FeedItem[] }) {
  const queryClient = useQueryClient();
  async function onMarkAllSeen() {
    await markSeen();
    await queryClient.invalidateQueries({ queryKey: ['/api/home'] });
  }
  return (
    <section aria-labelledby="feed-heading" className="flex flex-col gap-2 text-sm">
      <h2 id="feed-heading" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Since you last looked
      </h2>
      {items.length === 0 ? (
        <p className="text-muted-foreground">Nothing new.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <Item key={`${item.type} ${item.at} ${item.runKey} ${item.text}`} item={item} />
            ))}
          </ul>
          <Button variant="outline" size="sm" className="self-start" onClick={onMarkAllSeen}>
            Mark all seen
          </Button>
        </>
      )}
    </section>
  );
}
