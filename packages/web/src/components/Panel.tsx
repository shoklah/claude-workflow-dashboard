import { useId, type ReactNode, type Ref } from 'react';
import { cn } from 'cn';
import { WARNING_BORDER } from '../lib/format.ts';
import { NUM } from './Num.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.tsx';

/** A link's underline: the disclosure's summary and every in-table link. */
export const LINK = 'underline decoration-input underline-offset-4 hover:decoration-foreground';

/** A tooltip term's dotted underline: a focusable name whose tooltip says more (a session's chip, the reporter's mark). */
export const TERM = 'underline decoration-dotted underline-offset-4';

/** A tooltip term: its words, focusable, with `TERM`'s underline (`className` adds to it), and its tooltip `tip`. */
export function Term({ tip, className, children }: { tip: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={cn(TERM, className)}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

/**
 * A page's title, directly on the backdrop in primary ink. It names the browser's tab too ("Sessions - edward"), so the
 * two never disagree: React puts the `title` in the document's head, ahead of `index.html`'s "edward", which shows again
 * once no page title is drawn (a run's page while it loads).
 */
export function PageTitle({ children }: { children: string }) {
  return (
    <>
      <title>{`${children} - edward`}</title>
      <h1 tabIndex={-1} className="text-page-title outline-none">{children}</h1>
    </>
  );
}

/** A section's title. */
export function SectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-section-title">
      {children}
    </h2>
  );
}

type SectionProps = { title?: ReactNode; aside?: ReactNode; titleRef?: Ref<HTMLDivElement>; className?: string; children: ReactNode };

/** A section without glass, a region labelled by its title when it has one, the title and `aside` (a switch, a count)
 * in a row above its content (`titleRef` reaches that row). */
export function Section({ title, aside, titleRef, className, children }: SectionProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={title ? titleId : undefined} className={cn('flex flex-col gap-3', className)}>
      {(title || aside) && (
        <div ref={titleRef} className="flex flex-wrap items-center gap-3">
          {title && <SectionTitle id={titleId}>{title}</SectionTitle>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** A glass panel holding one group of related content, labelled by its title when it has one. */
export function Panel({ className, ...section }: SectionProps) {
  return <Section className={cn('glass p-4', className)} {...section} />;
}

/** Labelled pairs: each fact's name in secondary ink, its value beside it, right-aligned in tabular figures. With
 * `names`, a list of names with their detail (a skill's outcome, a model's cost): each name in primary ink on its own
 * row, its detail muted, so a long name keeps its line when another row's detail is long. With `inline`, one row of
 * facts that wraps: each term `beside` its value (a line of facts under a flow), or `over` it, the term small and the
 * value bold (a page's header facts, its terms in primary ink with `backdrop`, on the backdrop), or in `columns` on the backdrop (a goal section's totals): each pair as wide as
 * its `widths` class (from `sm`), its value at the column's end, so rows line up, and its term in primary ink. With
 * `text`, prose values: the terms' column as wide as the widest term, each value left-aligned beside its term and
 * wrapping there (Compliance's information lines). */
export function Pairs({
  pairs,
  names = false,
  text = false,
  inline,
  widths = [],
  backdrop = false,
  className,
}: {
  pairs: [ReactNode, ReactNode][];
  names?: boolean;
  text?: boolean;
  inline?: 'beside' | 'over' | 'columns';
  widths?: string[];
  backdrop?: boolean;
  className?: string;
}) {
  if (inline) {
    return (
      <dl className={cn('flex flex-wrap gap-x-6 gap-y-1 text-sm', className)}>
        {pairs.map(([term, value], i) => (
          <div
            key={i}
            className={cn(inline === 'beside' && 'flex gap-2', inline === 'columns' && ['flex justify-between gap-2', widths[i]])}
          >
            <dt className={cn(inline !== 'columns' && !backdrop && 'text-muted-foreground', inline === 'over' && 'text-xs font-medium')}>
              {term}
            </dt>
            <dd className={cn('tabular-nums', inline === 'over' && 'font-semibold')}>{value}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl
      className={cn(
        names ? 'flex flex-col' : 'grid gap-x-4',
        !names && (text ? 'grid-cols-[minmax(0,auto)_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)_auto]'),
        'gap-y-1 text-sm',
        className,
      )}
    >
      {pairs.map(([term, value], i) => (
        <div key={i} className={names ? 'flex flex-wrap justify-between gap-x-4' : 'contents'}>
          <dt className={cn(!names && 'text-muted-foreground')}>{term}</dt>
          <dd className={cn(text ? 'text-left tabular-nums' : NUM, names && 'text-muted-foreground')}>{value}</dd>
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

/** A page's line on the backdrop (a summary sentence, what showing mode left out), in primary ink; `muted` only on a
 * panel (a panel's line when it has nothing to show). */
export function Line({ muted = false, children }: { muted?: boolean; children: ReactNode }) {
  return <p className={cn('text-sm', muted && 'text-muted-foreground')}>{children}</p>;
}

/** A plain table inside a panel, named `label`, in a focusable region named "<label> table" that scrolls sideways with
 * the edge cue (`className` adds to the table). */
export function ScrollTable({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div data-scroll-cue className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${label} table`}>
      <table aria-label={label} className={cn('w-full border-collapse text-sm', className)}>
        {children}
      </table>
    </div>
  );
}

/** A plain table's column head, muted; `num` for a numeric column. */
export function ColumnHead({ num = false, children }: { num?: boolean; children: ReactNode }) {
  return (
    <th scope="col" className={cn('px-2 py-1.5 text-left font-medium text-muted-foreground', num && NUM)}>
      {children}
    </th>
  );
}

/** A region's loading, error or empty state: its panel with one line saying what is loading, what failed and what to
 * do, or that there is nothing (`className` adds to the panel, a findings table's side). */
export function State({ error = false, className, children }: { error?: boolean; className?: string; children: ReactNode }) {
  return <p className={cn('glass p-4 text-sm', error ? WARNING_BORDER : 'text-muted-foreground', className)}>{children}</p>;
}
