import { describe, expect, test } from 'vitest';
import { loadReport } from '../src/load.ts';
import { fixture } from './fixture.ts';

describe('loadReport', () => {
  test('accepts the full fixture', () => {
    const result = loadReport(fixture('report-full'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.runs).toHaveLength(5);
    expect(result.report.sessions).toHaveLength(2);
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
