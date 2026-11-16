import { cn } from 'cn';
import { formatWhole, NONE } from '../lib/format.ts';

/** A numeric column's alignment, for its header and its cells. */
export const NUM = 'text-right tabular-nums';

/** A group header over its sub-columns, in a table's two-row header. */
export const GROUP = 'h-8 border-b text-center';

/** A sub-column's header, under its group. */
export const SUB = 'h-8 font-medium text-muted-foreground';

/** An unknown value: a muted dash, read out as "not known". */
export function Unknown({ label = 'not known' }: { label?: string }) {
  return (
    <span className="text-muted-foreground">
      <span aria-hidden>{NONE}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** A number, whole and grouped unless `format` says otherwise: zero muted, unknown as the muted dash. */
export function Num({ value, format = formatWhole }: { value: number | null | undefined; format?: (n: number) => string }) {
  if (value == null) return <Unknown />;
  return <span className={cn(value === 0 && 'text-muted-foreground')}>{format(value)}</span>;
}

/** A text value, unknown as the muted dash. */
export function Text({ value, unknown }: { value: string | null | undefined; unknown?: string }) {
  return value ? <>{value}</> : <Unknown label={unknown} />;
}
