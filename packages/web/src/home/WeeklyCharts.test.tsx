import { describe, expect, it } from 'vitest';
import { barsOption } from './WeeklyCharts.tsx';

type Label = { show: boolean; formatter: (params: { dataIndex: number }) => string };
type Series = { label?: Label; labelLayout?: { hideOverlap: boolean } };

describe('barsOption totals', () => {
  const option = barsOption(
    ['2026-10-26', '2026-11-02', '2026-11-09'],
    [
      { name: 'a', data: [0, 1.5, null] },
      { name: 'b', data: [0, 2, null] },
    ],
    { stack: 's', cost: true, totals: true },
  );
  const top = option.series[1] as Series;

  it("writes each week's total above its bar on the top series", () => {
    expect(top.label?.formatter({ dataIndex: 1 })).toBe('$3.50');
  });

  it('writes no total over a week with no bar', () => {
    expect(top.label?.formatter({ dataIndex: 0 })).toBe('');
    expect(top.label?.formatter({ dataIndex: 2 })).toBe('');
  });

  it('hides totals that would overlap', () => {
    expect(top.labelLayout).toEqual({ hideOverlap: true });
  });
});
