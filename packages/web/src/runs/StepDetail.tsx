import { useEffect, useRef, type ReactNode } from 'react';
import type { FindingRow } from '@cwd/shared';
import { ArrowRight, X } from 'lucide-react';
import { cn } from 'cn';
import { Text } from '../components/Num.tsx';
import { Section } from '../components/Panel.tsx';
import { Button } from '../components/ui/button.tsx';
import {
  STEP_LABELS,
  WARNING_BORDER,
  WARNING_INK,
  byLabel,
  countName,
  outcomeLabel,
  outcomeWarns,
  roundVerdictLabel,
  stepBy,
  verdictLabel,
} from '../lib/format.ts';
import type { Unit } from './flow.ts';

/** A rule joining two marks, hidden from assistive tech: solid between marks, dashed across what a finding skipped and
 * from its last mark on. */
function Rule({ dashed = false }: { dashed?: boolean }) {
  return <span aria-hidden className={cn('h-0 min-w-3 flex-1 border-t border-muted-foreground', dashed && 'border-dashed')} />;
}

/** A mark's dot: filled for "Found", a green dot for a fix, an orange ring for any other verdict. */
function Dot({ verdict }: { verdict?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'size-2.5 flex-none rounded-full',
        verdict === undefined
          ? 'bg-foreground'
          : verdict === 'fixed'
            ? 'border-2 border-success-edge bg-success-edge'
            : cn('border-2', WARNING_BORDER),
      )}
    />
  );
}

/** A verdict's words: in the warning ink unless it is a fix, since the workflow counts every other verdict as open. */
function Verdict({ verdict, children }: { verdict: string; children: ReactNode }) {
  return <span className={cn('whitespace-nowrap', verdict !== 'fixed' && WARNING_INK)}>{children}</span>;
}

/** How a finding ended, as a chip: Open and No outcome in the warning ink, Fixed and Applied with a green edge, Ruled and
 * Declined muted. */
function Ended({ finding }: { finding: FindingRow }) {
  const outcome = finding.outcome ?? 'none';
  return (
    <span
      className={cn(
        'w-fit rounded-control border px-2.5 py-0.5 whitespace-nowrap',
        outcomeWarns(outcome) && cn(WARNING_BORDER, WARNING_INK),
        (outcome === 'fixed' || outcome === 'applied') && 'border-success-edge',
        (outcome === 'ruled' || outcome === 'declined') && 'text-muted-foreground',
      )}
    >
      {outcomeLabel(outcome)}
    </span>
  );
}

/** A finding: its id and severity, its summary under them. */
function Finding({ finding }: { finding: FindingRow }) {
  return (
    <>
      <span className="flex gap-1.5 text-xs">
        <span className="font-semibold">{finding.id}</span>
        {finding.severity && <span className="text-muted-foreground">{countName(finding.severity)}</span>}
      </span>
      <span className="block text-sm">
        <Text value={finding.summary} />
      </span>
    </>
  );
}

/** A column's head: its title, and under it who ran it. */
function Head({ title, by }: { title: string; by?: string }) {
  return (
    <th scope="col" className="px-2 pb-2 text-left align-bottom font-normal">
      <span className="block text-sm font-semibold">{title}</span>
      {by && (
        // Word by word, each whole, so an agent's name never breaks at its hyphen.
        <span className="text-muted-foreground">
          {by.split(' ').map((word, i) => (
            <span key={i}>
              {i > 0 && ' '}
              <span className="whitespace-nowrap">{word}</span>
            </span>
          ))}
        </span>
      )}
    </th>
  );
}

/**
 * The selected step's detail: its name with a Close pill, then one line per finding, from its review through each fix
 * round to how it ended; a table from `md` up, a stacked list below. A step that found nothing says so in one line.
 */
export function StepDetail({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const { name, review, rounds, findings } = unit;
  const kind = review ? STEP_LABELS[review.step] : name;
  const columns = Math.max(rounds.length, ...findings.map((f) => f.verdicts.length));
  const titleRow = useRef<HTMLDivElement>(null);
  // A step's detail opening, or showing another step, brings its title row into view if it isn't (instant under
  // reduced motion); closing it doesn't scroll.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    titleRow.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'instant' : 'smooth' });
  }, [unit.id]);
  return (
    <Section
      title={name}
      titleRef={titleRow}
      aside={
        <Button size="sm" variant="outline" className="ml-auto" aria-label={`Close ${name}`} onClick={onClose}>
          <X aria-hidden /> Close
        </Button>
      }
    >
      {findings.length === 0 ? (
        <p className="text-sm text-muted-foreground">{`${kind} ${byLabel(review)} found nothing.`}</p>
      ) : (
        <>
          <div data-scroll-cue className="hidden overflow-x-auto md:block" tabIndex={0} role="region" aria-label={`${name} table`}>
            <table aria-label={name} className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <Head title="Finding" />
                  <Head title={kind} by={stepBy(review)} />
                  {Array.from({ length: columns }, (_, i) => (
                    <Head key={i} title={`Fix round ${i + 1}`} by={rounds[i] && `checked ${byLabel(rounds[i])}`} />
                  ))}
                  <Head title="Ended" />
                </tr>
              </thead>
              <tbody>
                {findings.map((f, i) => (
                  <tr key={i} className="border-t">
                    <th scope="row" className="max-w-64 min-w-48 px-2 py-2 text-left align-top font-normal">
                      <Finding finding={f} />
                    </th>
                    <td className="py-2 align-top">
                      <span className="flex items-center gap-1.5">
                        <Dot />
                        <span>Found</span>
                        <Rule dashed={f.verdicts.length === 0} />
                      </span>
                    </td>
                    {Array.from({ length: columns }, (_, r) => {
                      const verdict = f.verdicts[r];
                      return (
                        <td key={r} className="py-2 align-top">
                          <span className="flex items-center gap-1.5">
                            {verdict === undefined ? (
                              <Rule dashed />
                            ) : (
                              <>
                                <Rule />
                                <Dot verdict={verdict} />
                                <Verdict verdict={verdict}>{verdictLabel(verdict)}</Verdict>
                                <Rule dashed={r + 1 >= f.verdicts.length} />
                              </>
                            )}
                          </span>
                        </td>
                      );
                    })}
                    <td className="min-w-40 px-2 py-2 align-top">
                      <span className="flex flex-col gap-1">
                        <Ended finding={f} />
                        {f.reason && <span className="text-muted-foreground">{f.reason}</span>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col gap-3 md:hidden">
            {findings.map((f, i) => (
              <li key={i} className="flex flex-col gap-1.5 border-t pt-2 text-xs">
                <span>
                  <Finding finding={f} />
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="flex items-center gap-1.5">
                    <Dot />
                    Found
                  </span>
                  {f.verdicts.map((verdict, r) => (
                    <span key={r} className="flex items-center gap-1.5">
                      <ArrowRight aria-hidden className="size-3 text-muted-foreground" />
                      <Dot verdict={verdict} />
                      <Verdict verdict={verdict}>{roundVerdictLabel(r + 1, verdict)}</Verdict>
                    </span>
                  ))}
                  <ArrowRight aria-hidden className="size-3 text-muted-foreground" />
                  <Ended finding={f} />
                </span>
                {f.reason && <span className="text-muted-foreground">{f.reason}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}
