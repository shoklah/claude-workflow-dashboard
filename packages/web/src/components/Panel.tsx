import { useId, type ReactNode } from 'react';
import { cn } from 'cn';
import { WARNING_BORDER } from '../lib/format.ts';
import { NUM } from './Num.tsx';

/** A link's underline: the disclosure's summary and every in-table link. */
export const LINK = 'underline decoration-input underline-offset-4 hover:decoration-foreground';

/** A tooltip term's dotted underline: a focusable name whose tooltip says more (a session's chip, the reporter's mark). */
export const TERM = 'underline decoration-dotted underline-offset-4';

/** A page's title, directly on the backdrop in primary ink. */
export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-page-title">{children}</h1>;
}

/** A section's title. */
export function SectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-section-title">
      {children}
    </h2>
  );
}

/** A glass panel holding one group of related content, labelled by its title when it has one. */
export function Panel({ title, aside, className, children }: { title?: string; aside?: ReactNode; className?: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <section aria-labelledby={title ? titleId : undefined} className={cn('glass flex flex-col gap-3 p-4', className)}>
      {(title || aside) && (
        <div className="flex flex-wrap items-center gap-3">
          {title && <SectionTitle id={titleId}>{title}</SectionTitle>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** Labelled pairs: each fact's name in secondary ink, its value beside it, right-aligned in tabular figures. With
 * `names`, a list of names with their detail (a skill's outcome, a model's cost): each name in primary ink on its own
 * row, its detail muted, so a long name keeps its line when another row's detail is long. */
export function Pairs({ pairs, names = false, className }: { pairs: [string, ReactNode][]; names?: boolean; className?: string }) {
  return (
    <dl className={cn(names ? 'flex flex-col' : 'grid grid-cols-[minmax(0,1fr)_auto] gap-x-4', 'gap-y-1 text-sm', className)}>
      {pairs.map(([term, value], i) => (
        <div key={i} className={names ? 'flex flex-wrap justify-between gap-x-4' : 'contents'}>
          <dt className={cn(!names && 'text-muted-foreground')}>{term}</dt>
          <dd className={cn(NUM, names && 'text-muted-foreground')}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A disclosure under a region (how it is counted, a chart's table view): its summary reads as a control, in primary
 * ink with an underline, since it sits on the backdrop. */
export function Details({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="text-sm">
      <summary className={cn('w-fit cursor-pointer rounded-sm', LINK)}>{summary}</summary>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </details>
  );
}

/** A page's line on the backdrop (a summary sentence, what showing mode left out), in primary ink. */
export function Line({ children }: { children: ReactNode }) {
  return <p className="text-sm">{children}</p>;
}

/** A region's loading or error state: its panel with one line saying what is loading, or what failed and what to do. */
export function State({ error = false, children }: { error?: boolean; children: ReactNode }) {
  return <p className={cn('glass p-4 text-sm', error ? WARNING_BORDER : 'text-muted-foreground')}>{children}</p>;
}
