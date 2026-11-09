import type { WeekNumbers } from '@cwd/shared';
import { actedOnSplit, formatCost } from '../lib/format.ts';

// runs: the week's runs on every path, the sum of WeekNumbers.runs.
const runCount = (week: WeekNumbers) => week.runs.small + week.runs.full + week.runs.plan;

function Tile({ label, value, detail, lastWeek }: { label: string; value: string; detail: string; lastWeek: string }) {
  return (
    <div role="group" aria-label={label} className="flex-1 rounded-lg border bg-card px-3 py-2 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      <div>{detail}</div>
      <div className="text-muted-foreground">last week {lastWeek}</div>
    </div>
  );
}

/** This week's four numbers, each against last week's. */
export function WeekTiles({ thisWeek, lastWeek }: { thisWeek: WeekNumbers; lastWeek: WeekNumbers }) {
  const { small, full, plan } = thisWeek.runs;
  return (
    <div className="flex gap-3">
      <Tile
        label="Runs this week"
        value={String(runCount(thisWeek))}
        detail={`small ${small} · full ${full} · plan ${plan}`}
        lastWeek={String(runCount(lastWeek))}
      />
      <Tile
        label="Findings"
        value={String(thisWeek.findings.total)}
        detail={actedOnSplit(thisWeek.findings)}
        lastWeek={String(lastWeek.findings.total)}
      />
      <Tile
        label="Est. cost"
        value={formatCost(thisWeek.cost)}
        detail={`${formatCost(thisWeek.costPerRun)} a run`}
        lastWeek={formatCost(lastWeek.cost)}
      />
      <Tile
        label="Warnings"
        value={String(thisWeek.warnings)}
        detail={`${thisWeek.newWarnings} new`}
        lastWeek={String(lastWeek.warnings)}
      />
    </div>
  );
}
