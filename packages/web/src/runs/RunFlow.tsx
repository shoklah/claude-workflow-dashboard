import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from 'cn';
import { Time } from '../layout/StatusBanner.tsx';
import { STEP_LABELS, WARNING_BORDER, WARNING_INK, formatWhole, outcomeLabel, outcomeWarns, plural, reviewerLabel, roundsLabel } from '../lib/format.ts';
import { layout, stuck, type Edge, type Placed, type Shape, type Stage, type Unit } from './flow.ts';

type Pick = { selected: string | null; onSelect: (id: string | null) => void };
type Of<K extends Placed['kind']> = Extract<Placed, { kind: K }>;

const at = ({ x, y, w, h }: Placed): CSSProperties => ({ left: x, top: y, width: w, height: h });

/** An edge: lying down, a curve between its two ends; standing up, straight runs (`lead`) beside a loop's label or the
 * exit chips, and a curve between them; a fade, a straight run to or from the panel's side. */
export function pathOf({ from, to, fade }: Edge, shape: Shape): string {
  if (fade) return `M${from.x} ${from.y} H${to.x}`;
  if (shape === 'upright') {
    const a = from.y + (from.lead ?? 0);
    const b = to.y - (to.lead ?? 0);
    const m = (a + b) / 2;
    return `M${from.x} ${from.y} V${a} C${from.x} ${m}, ${to.x} ${m}, ${to.x} ${b} V${to.y}`;
  }
  const m = (from.x + to.x) / 2;
  return `M${from.x} ${from.y} C${m} ${from.y}, ${m} ${to.y}, ${to.x} ${to.y}`;
}

/** A loop's arc over its box, from its right back to its left. */
function arcOf({ x, y, w }: Of<'unit'>): string {
  const cx = x + w / 2;
  const r = Math.min(34, w / 2 - 22);
  return `M${cx + r} ${y - 1} C${cx + r} ${y - 28}, ${cx - r} ${y - 28}, ${cx - r} ${y - 2}`;
}

/** Each exit chip's dashed edge: down from the box, or from the chip above, then across to the chip. */
function exitsOf(box: Of<'unit'>, chips: Of<'chip'>[]): string[] {
  const x = box.x + 12;
  return chips.map((chip, i) => {
    const top = i === 0 ? box.y + box.h : chips[i - 1].y + chips[i - 1].h / 2;
    return `M${x} ${top} V${chip.y + chip.h / 2} H${chip.x}`;
  });
}

/** The loop's label: the agent that ran the checks and the round count, which a screen reader gets as words; a stuck
 * loop's also an icon, and words saying its last round left findings open. */
function LoopLabel({ arc }: { arc: Of<'arc'> }) {
  const { unit } = arc;
  const n = unit.rounds.length;
  const round = unit.rounds[0];
  const open = stuck(unit);
  return (
    <span className={cn('absolute truncate text-center text-xs', open && WARNING_INK)} style={{ ...at(arc), height: undefined }}>
      {open && <CircleAlert aria-hidden className="mr-1 inline size-3 align-middle" />}
      {round.agent ?? STEP_LABELS[round.step]} <span className="sr-only">{roundsLabel(n, open)}</span>
      <span aria-hidden className="font-semibold tabular-nums">
        ×{formatWhole(n)}
      </span>
    </span>
  );
}

/** A graph box's look, the session graph's too: a rectangle at its place, its lines stacked and centred. */
export const BOX = 'absolute flex flex-col justify-center rounded-lg border bg-secondary px-2.5 text-left leading-tight';

/** A box: its name, its reviewer and what it found; pressing it selects it, pressing it again clears it. */
function Box({ box, selected, onSelect }: { box: Of<'unit'> } & Pick) {
  const { unit } = box;
  const on = selected === unit.id;
  const found = unit.findings.length;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onSelect(on ? null : unit.id)}
      className={cn(
        BOX,
        'hover:bg-accent',
        stuck(unit) && WARNING_BORDER,
        on && 'outline-2 outline-offset-2 outline-ring',
      )}
      style={at(box)}
    >
      <span className="truncate text-sm font-semibold">{unit.name}</span>
      <span className="truncate text-xs text-muted-foreground">{reviewerLabel(unit.review)}</span>
      <span className="text-xs">
        Found <span className={cn('font-semibold tabular-nums', found === 0 && 'text-muted-foreground')}>{formatWhole(found)}</span>
      </span>
    </button>
  );
}

/** A chip for what a step left with one outcome: Open and No outcome in the warning ink, the others muted. */
function Chip({ chip }: { chip: Of<'chip'> }) {
  const text = `${outcomeLabel(chip.outcome)} ${formatWhole(chip.count)}`;
  return (
    <span
      title={text}
      className={cn('absolute truncate rounded-control border border-dashed px-1 py-px text-xs', outcomeWarns(chip.outcome) ? WARNING_INK : 'text-muted-foreground')}
      style={at(chip)}
    >
      {text}
    </span>
  );
}

/** The run as a graph, laid out by `layout` for the width it is given: edges as SVG paths, hidden from assistive
 * tech, and everything with text as HTML at its rectangle, in reading order (a box, its loop's label, its chips). */
export function RunFlow({ stages, ...pick }: { stages: Stage[] } & Pick) {
  const frame = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = frame.current!;
    const measure = () => setAvail(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const id = useId();
  const { shape, width, height, placed, edges } = useMemo(() => layout(stages, avail), [stages, avail]);
  const boxes = placed.filter((p): p is Of<'unit'> => p.kind === 'unit');
  const chipsOf = (unit: Unit) => placed.filter((p): p is Of<'chip'> => p.kind === 'chip' && p.unit === unit);
  const arrow = (tone: string) => `url(#${id}-${tone})`;
  return (
    <div ref={frame} role="group" aria-label="The run's flow">
      <div className="relative mx-auto" style={{ width, height }}>
        <svg aria-hidden className="absolute inset-0 overflow-visible text-muted-foreground" width={width} height={height}>
          <defs>
            {(
              [
                ['line', 'text-muted-foreground'],
                ['ok', 'text-success-edge'],
                ['stuck', 'text-warning-edge'],
              ] as const
            ).map(([tone, ink]) => (
              <marker
                key={tone}
                id={`${id}-${tone}`}
                className={ink}
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
              </marker>
            ))}
            {edges.map(({ from, to, fade }, i) =>
              fade ? (
                <linearGradient key={i} id={`${id}-fade-${i}`} gradientUnits="userSpaceOnUse" x1={from.x} x2={to.x} y1={0} y2={0}>
                  <stop offset={fade === 'out' ? 0.2 : 0} stopColor="currentColor" stopOpacity={fade === 'out' ? 1 : 0} />
                  <stop offset={fade === 'out' ? 1 : 0.8} stopColor="currentColor" stopOpacity={fade === 'out' ? 0 : 1} />
                </linearGradient>
              ) : null,
            )}
          </defs>
          {edges.map((edge, i) => (
            <path
              key={i}
              d={pathOf(edge, shape)}
              fill="none"
              stroke={edge.fade ? `url(#${id}-fade-${i})` : 'currentColor'}
              strokeWidth={1.5}
              markerEnd={edge.head ? arrow('line') : undefined}
            />
          ))}
          {boxes.map((box) =>
            box.unit.rounds.length ? (
              <path
                key={box.unit.id}
                className={stuck(box.unit) ? 'text-warning-edge' : 'text-success-edge'}
                d={arcOf(box)}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                markerEnd={arrow(stuck(box.unit) ? 'stuck' : 'ok')}
              />
            ) : null,
          )}
          {boxes.flatMap((box) =>
            exitsOf(box, chipsOf(box.unit)).map((d, i) => (
              <path key={`${box.unit.id}-${i}`} d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeDasharray="3 3" />
            )),
          )}
        </svg>
        {placed.map((p, i) => {
          switch (p.kind) {
            case 'pill':
              return (
                <div key={i} className="absolute flex flex-col justify-center rounded-control border px-3 text-xs whitespace-nowrap" style={at(p)}>
                  <span className="font-semibold">{p.end === 'start' ? 'Started' : 'Record written'}</span>
                  {p.at && (
                    <span className="text-muted-foreground">
                      <Time iso={p.at} />
                    </span>
                  )}
                </div>
              );
            case 'conflicts':
              return (
                <span
                  key={i}
                  className={cn('absolute text-xs whitespace-nowrap text-muted-foreground', shape !== 'upright' && 'text-center')}
                  style={at(p)}
                >
                  {plural(p.count, 'conflict')}
                </span>
              );
            case 'unit':
              return <Box key={i} box={p} {...pick} />;
            case 'arc':
              return <LoopLabel key={i} arc={p} />;
            case 'chip':
              return <Chip key={i} chip={p} />;
          }
        })}
      </div>
    </div>
  );
}
