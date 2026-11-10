import { describe, expect, test } from 'vitest';
import { loadReport } from '../src/load.ts';
import { reporterTotals } from '../src/report.ts';
import { fixture } from './fixture.ts';

describe('loadReport', () => {
  test('accepts the full fixture', () => {
    const result = loadReport(fixture('report-full'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.runs).toHaveLength(5);
    expect(result.report.sessions).toHaveLength(2);
  });

  test('reads the merged reporter keys of the schema 5 fixture', () => {
    const result = loadReport(fixture('report-v5'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { report } = result;
    const run = report.runs.find((r) => r.schema === 5)!;
    expect(run.warnings?.map((w) => [w.kind, w.step?.step ?? null])).toEqual([
      ['step_agent_missing', 'final_review'],
      ['brand_new_check', null],
    ]);
    expect(run.warnings?.map((w) => w.text)).toEqual(run.warns);
    expect(run.title).toBe('Webhook delivery with retries');
    expect(report.sessions[0].warnings).toEqual([]);
    const findings = run.steps!.flatMap((s) => s.findings ?? []);
    expect(findings.find((f) => f.id === 'F3')).toMatchObject({ category: 'error_handling', validity: 'valid' });
    expect(findings.find((f) => f.id === 'F4')).toMatchObject({ category: null, validity: null });
    expect(run.steps!.filter((s) => s.strengths?.length).map((s) => s.step)).toEqual(['task_review', 'final_review']);
    expect(run.offers?.[0]).toEqual({ skill: 'graphify', outcome: 'accepted' });
    expect(run.record?.failing_test?.[1]).toEqual({ result: 'no_tests' });
    expect(report.categories?.areas?.[0].list?.[0].id).toBe('scope');
    expect(report.categories?.validity?.invalid).toBe("The problem isn't there, or the reviewer misread the brief or the code.");
    expect(report.totals.scoreboard?.task_review?.ran).toBe(12);
    expect(report.totals.run_time?.with_waves?.runs).toBe(1);
    expect(report.totals.advisor?.weeks?.[0].stop).toBe(false);
  });

  test('accepts a failing-test entry whose task isn’t a number, as the raw record a session wrote', () => {
    const json = fixture('report-v5');
    const run = json.runs.find((r: { schema: number }) => r.schema === 5);
    run.record.failing_test = [{ task: 'wave A', result: 'passed' }, { task: null, result: 'exempt' }];
    const result = loadReport(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const loaded = result.report.runs.find((r) => r.schema === 5)!;
    expect(loaded.record?.failing_test?.map((item) => item.result)).toEqual(['passed', 'exempt']);
  });

  test('refuses version 2', () => {
    const raw = fixture('report-full');
    raw.version = 2;
    const result = loadReport(raw);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('version');
  });

  test('reports field paths for a bad shape', () => {
    const result = loadReport(fixture('report-shape'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('shape');
    expect(result.fields).toEqual(['runs[].steps']);
  });

  test('ignores unknown keys', () => {
    const raw = fixture('report-full');
    raw.runs[0].extra = 'x';
    const result = loadReport(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.runs[0]).not.toHaveProperty('extra');
  });

  test('treats a missing key as absent', () => {
    const raw = fixture('report-full');
    delete raw.runs[0].minutes;
    const result = loadReport(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.runs[0].minutes).toBeUndefined();
  });

  test('treats a missing skill outcome as absent', () => {
    const raw = fixture('report-full');
    const run = raw.runs.find((r: any) => r.skills?.length);
    delete run.skills[0].outcome;
    expect(loadReport(raw).ok).toBe(true);
  });

  test('writes map keys as {}', () => {
    const raw = fixture('report-full');
    const run = raw.runs.find((r: any) => r.models !== null);
    const model = Object.keys(run.models)[0];
    run.models[model].cost = 'x';
    const result = loadReport(raw);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fields).toEqual(['runs[].models{}.cost']);
  });
});

describe('reporterTotals', () => {
  test('parses the stored totals as the schema reads them', () => {
    const totals = reporterTotals(fixture('report-v5').totals);
    expect(totals?.scoreboard?.dispatch_guard).toEqual({ no_model: 1, no_simplify: 1 });
    expect(reporterTotals(fixture('report-full').totals)?.scoreboard).toBeUndefined();
  });

  test('is null with no import, or for totals the schema rejects', () => {
    expect(reporterTotals(undefined)).toBeNull();
    expect(reporterTotals(null)).toBeNull();
    expect(reporterTotals({ weeks: 'not a list' })).toBeNull();
  });
});
