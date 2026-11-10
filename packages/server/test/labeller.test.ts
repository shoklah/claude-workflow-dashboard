import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { loadReport } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { importReport } from '../src/db/import.ts';
import { listUnits } from '../src/db/read.ts';
import { activeList, type ActiveList } from '../src/categories.ts';
import { currentLabels, labelInputs, labelledOn, saveBatch, tokensSince, type LabelInput } from '../src/db/labels.ts';
import {
  anthropicLabelClient,
  LabelError,
  labellerSettings,
  labelPending,
  type LabelClient,
} from '../src/labeller.ts';

const IMPORTED = new Date('2026-11-10T18:00:00Z');
const NOW = new Date('2026-11-10T20:00:00Z');
const LATER_SAME_DAY = new Date('2026-11-10T22:00:00Z');
const MODEL = 'claude-haiku-5-5';

type Item = Parameters<LabelClient>[0][number];
type Result = Awaited<ReturnType<LabelClient>>['results'][number];

const dirs: string[] = [];
const dbs: Db[] = [];

function freshDb(): Db {
  const dir = mkdtempSync(join(tmpdir(), 'cwd labeller '));
  dirs.push(dir);
  const db = openDb(join(dir, 'data dir', 'dashboard.sqlite'));
  dbs.push(db);
  return db;
}

/** A database with `raw` (a fixture, or a changed copy of one) imported as the server does. */
function imported(raw: any): Db {
  const db = freshDb();
  const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
  if (!loaded.ok) throw new Error('the fixture does not load');
  importReport(db, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, IMPORTED);
  return db;
}

/** report-v5 with the plan run's findings repeated under new ids, F100 onward, until `total` have ids. */
function withFindings(total: number): any {
  const raw = fixture('report-v5');
  const steps = raw.runs.flatMap((r: any) => r.steps ?? []).filter((s: any) => s.step);
  let count = steps.flatMap((s: any) => s.findings ?? []).filter((f: any) => f.id).length;
  const run = raw.runs.find((r: any) => r.steps?.some((s: any) => s.step === 'plan_review'));
  const findings = run.steps.flatMap((s: any) => s.findings ?? []);
  for (let n = 0; count < total; n++, count++) {
    run.steps[0].findings.push({ ...findings[n % findings.length], id: `F${100 + n}` });
  }
  return raw;
}

function inputs(db: Db): LabelInput[] {
  return labelInputs(listUnits(db, 'run'));
}

/** The database's active list, which every labelled case here has: report-v5's, number 101. */
const list = (db: Db): ActiveList => activeList(db)!;

function stored(db: Db): number {
  return currentLabels(db, inputs(db), list(db).number).size;
}

const validAnswer = (item: Item, active: ActiveList): Result => ({
  id: item.id,
  category: active.areas[item.area][0]!.id,
  relevance: 'valid',
  reason: 'An invented reason.',
});

/** A stub client that records each batch it is sent and answers each item with `answer`. */
function stubClient(answer: (item: Item, active: ActiveList) => Result[] = (item, active) => [validAnswer(item, active)]) {
  const batches: Item[][] = [];
  const client: LabelClient = async (batch, active) => {
    batches.push(batch);
    return { results: batch.flatMap((item) => answer(item, active)), inputTokens: 1000, outputTokens: 200 };
  };
  return { batches, client };
}

afterEach(() => {
  for (const db of dbs.splice(0)) db.$client.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('labelPending', () => {
  test('sends 60 pending findings (37 plan, 16 implementation, 7 cleanup) in batches of one area, at most 25, ids from f1', async () => {
    const db = imported(withFindings(60));
    expect(inputs(db)).toHaveLength(60);
    const { batches, client } = stubClient();
    await labelPending(db, client, { model: MODEL, dailyMax: 500 }, NOW, list(db));
    expect(batches.map((b) => b.length)).toEqual([25, 12, 16, 7]);
    expect(batches[0]!.map((i) => i.id)).toEqual(Array.from({ length: 25 }, (_, n) => `f${n + 1}`));
    expect(batches[1]!.map((i) => i.id)).toEqual(Array.from({ length: 12 }, (_, n) => `f${n + 1}`));
    expect(stored(db)).toBe(60);
    expect(tokensSince(db, IMPORTED)).toEqual({ input: 4000, output: 800 });
  });

  test('stops at the daily max, and a second run the same day stores none', async () => {
    const db = imported(withFindings(60));
    const { batches, client } = stubClient();
    await labelPending(db, client, { model: MODEL, dailyMax: 30 }, NOW, list(db));
    expect(stored(db)).toBe(30);
    await labelPending(db, client, { model: MODEL, dailyMax: 30 }, LATER_SAME_DAY, list(db));
    expect(stored(db)).toBe(30);
    expect(batches.map((b) => b.length)).toEqual([23, 4, 3]);
  });

  test("each batch holds one area's findings, so its reply's schema can hold that area's ids only", async () => {
    const db = imported(withFindings(60));
    expect(new Set(inputs(db).map((i) => i.area)).size).toBeGreaterThan(1);
    const { batches, client } = stubClient();
    await labelPending(db, client, { model: MODEL, dailyMax: 500 }, NOW, list(db));
    for (const batch of batches) expect(new Set(batch.map((i) => i.area)).size).toBe(1);
    expect(stored(db)).toBe(60);
  });

  test("doesn't store a category outside the finding's area", async () => {
    const db = imported(fixture('report-v5'));
    const all = inputs(db);
    const { client } = stubClient((item, active) => [
      item.area === 'plan' ? { ...validAnswer(item, active), category: 'correctness' } : validAnswer(item, active),
    ]);
    await labelPending(db, client, { model: MODEL, dailyMax: 500 }, NOW, list(db));
    const labels = currentLabels(db, all, list(db).number);
    expect(labels.size).toBe(all.filter((i) => i.area !== 'plan').length);
    for (const input of all.filter((i) => i.area === 'plan')) {
      expect(labels.has(`${input.runKey} ${input.findingId}`)).toBe(false);
    }
  });

  test("under list 101, a reply naming the app's old 'task split and order' isn't stored, and 'task_split' is", async () => {
    const db = imported(fixture('report-v5'));
    const plan = inputs(db).filter((i) => i.area === 'plan');
    const answer = (category: string) =>
      stubClient((item, active) => [item.area === 'plan' ? { ...validAnswer(item, active), category } : []].flat());
    await labelPending(db, answer('task split and order').client, { model: MODEL, dailyMax: 500 }, NOW, list(db));
    expect(currentLabels(db, plan, 101).size).toBe(0);
    await labelPending(db, answer('task_split').client, { model: MODEL, dailyMax: 500 }, NOW, list(db));
    const labels = currentLabels(db, plan, 101);
    expect(labels.size).toBe(plan.length);
    expect([...labels.values()].every((l) => l.category === 'task_split')).toBe(true);
  });

  test("a finding whose area has no categories in the list isn't sent; the others are", async () => {
    const db = imported(fixture('report-v5'));
    const all = inputs(db);
    const noPlan: ActiveList = { ...list(db), areas: { ...list(db).areas, plan: [] } };
    const { batches, client } = stubClient();
    await labelPending(db, client, { model: MODEL, dailyMax: 500 }, NOW, noPlan);
    const sent = batches.flat();
    expect(sent.some((item) => item.area === 'plan')).toBe(false);
    expect(sent).toHaveLength(all.filter((i) => i.area !== 'plan').length);
    expect(stored(db)).toBe(sent.length);
  });

  test('a list with a version but no areas sends nothing', async () => {
    const raw = fixture('report-v5');
    raw.categories.areas = null;
    const db = imported(raw);
    expect(list(db).number).toBe(101);
    const { batches, client } = stubClient();
    await labelPending(db, client, { model: MODEL, dailyMax: 500 }, NOW, list(db));
    expect(batches).toEqual([]);
    expect(tokensSince(db, IMPORTED)).toEqual({ input: 0, output: 0 });
  });

  test("the daily max counts the day's labels under list 1 too, after the switch to list 101", async () => {
    const db = freshDb();
    const raw = fixture('report-full');
    const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
    if (!loaded.ok) throw new Error('the fixture does not load');
    importReport(db, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, IMPORTED);
    const old = inputs(db).slice(0, 5).map((input) => ({
      ...input,
      model: MODEL,
      category: 'correctness',
      relevance: 'valid' as const,
      reason: 'An invented reason.',
      labelledAt: NOW,
    }));
    saveBatch(db, old, { at: NOW, inputTokens: 0, outputTokens: 0 }, 1);
    const v5 = fixture('report-v5');
    const loadedV5 = loadReport(JSON.parse(JSON.stringify(v5)));
    if (!loadedV5.ok) throw new Error('the fixture does not load');
    importReport(db, loadedV5.report, { runs: v5.runs, sessions: v5.sessions, totals: v5.totals }, IMPORTED);
    expect(inputs(db).length).toBeGreaterThan(10);
    const { client } = stubClient();
    await labelPending(db, client, { model: MODEL, dailyMax: 10 }, LATER_SAME_DAY, list(db));
    expect(stored(db)).toBe(5);
    expect(labelledOn(db, NOW)).toBe(10);
  });

  test('keeps the first result for an id named twice, and drops an id that was not sent', async () => {
    const db = imported(fixture('report-v5'));
    const all = inputs(db);
    const { client } = stubClient((item, active) => [
      validAnswer(item, active),
      { ...validAnswer(item, active), relevance: 'invalid' },
      { ...validAnswer(item, active), id: 'f99' },
    ]);
    await labelPending(db, client, { model: MODEL, dailyMax: 500 }, NOW, list(db));
    const labels = [...currentLabels(db, all, list(db).number).values()];
    expect(labels).toHaveLength(all.length);
    expect(labels.every((l) => l.relevance === 'valid')).toBe(true);
  });

  test('a throwing batch stores nothing and is logged without its text; the next batches are labelled', async () => {
    const db = imported(withFindings(60));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { batches, client: answering } = stubClient();
    let calls = 0;
    let text = '';
    const client: LabelClient = async (batch, active) => {
      // The first batch fails every time, with an error that quotes a finding.
      if (++calls === 1) {
        text = batch[0]!.text;
        throw new Error(`no label for ${text}`);
      }
      return answering(batch, active);
    };
    await labelPending(db, client, { model: MODEL, dailyMax: 500 }, NOW, list(db));
    expect(calls).toBe(4);
    expect(batches.map((b) => b.length)).toEqual([12, 16, 7]);
    expect(stored(db)).toBe(35);
    expect(tokensSince(db, IMPORTED)).toEqual({ input: 3000, output: 600 });
    expect(error).toHaveBeenCalledWith('label batch failed:', 'Error');
    expect(JSON.stringify(error.mock.calls)).not.toContain(text);
    error.mockRestore();
  });

  test("a LabelError's fixed message is logged", async () => {
    const db = imported(fixture('report-v5'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const message = "the labeller's reply did not parse (stop reason: max_tokens)";
    const client: LabelClient = async () => {
      throw new LabelError(message);
    };
    await labelPending(db, client, { model: MODEL, dailyMax: 500 }, NOW, list(db));
    expect(error).toHaveBeenCalledWith('label batch failed:', message);
    error.mockRestore();
  });
});

describe('anthropicLabelClient', () => {
  /**
   * Runs `check` with the API pointed at a local stand-in, never the API itself, that answers every request with the
   * invented reply `text` and `stop_reason`, and records each request's body.
   */
  async function withStandIn(
    text: string,
    stopReason: string,
    check: (requests: any[]) => Promise<void>,
  ): Promise<void> {
    const requests: any[] = [];
    const server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        requests.push(JSON.parse(body));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id: 'msg_invented',
            type: 'message',
            role: 'assistant',
            model: MODEL,
            content: [{ type: 'text', text }],
            stop_reason: stopReason,
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 4096 },
          }),
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const env = { key: process.env.ANTHROPIC_API_KEY, url: process.env.ANTHROPIC_BASE_URL };
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      await check(requests);
    } finally {
      for (const [name, value] of [['ANTHROPIC_API_KEY', env.key], ['ANTHROPIC_BASE_URL', env.url]] as const) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      await new Promise((resolve) => server.close(resolve));
    }
  }

  test('a reply cut off at max_tokens throws a LabelError naming the stop reason, not the reply', async () => {
    const active = list(imported(fixture('report-v5')));
    await withStandIn('{"labels":[{"id":"f1","category":"invented-cut-off', 'max_tokens', async () => {
      const client = anthropicLabelClient(MODEL);
      const result = client([{ id: 'f1', area: 'plan', text: 'An invented finding.' }], active);
      await expect(result).rejects.toThrow(LabelError);
      await expect(result).rejects.toThrow("the labeller's reply did not parse (stop reason: max_tokens)");
    });
  });

  test("the prompt and the reply's schema come from the list it is given on each call", async () => {
    const active = list(imported(fixture('report-v5')));
    const reply = JSON.stringify({ labels: [{ id: 'f1', category: 'task_split', relevance: 'valid', reason: 'Invented.' }] });
    await withStandIn(reply, 'end_turn', async (requests) => {
      const client = anthropicLabelClient(MODEL);
      const batch = [{ id: 'f1', area: 'plan' as const, text: 'An invented finding.' }];
      const result = await client(batch, active);
      expect(result.results).toEqual([{ id: 'f1', category: 'task_split', relevance: 'valid', reason: 'Invented.' }]);
      const system: string = requests[0].system;
      expect(system).toContain(
        "task_split: Tasks too big or too small, in the wrong order, depending on each other when they shouldn't, or grouped into a wave that breaks its rules.",
      );
      expect(system).toContain(active.rule);
      expect(system).toContain(`invalid: ${active.validity.invalid}`);
      expect(system).not.toContain('worth raising');
      const category = JSON.stringify(requests[0].output_config.format.schema);
      expect(category).toContain('"code_facts"');
      expect(category).not.toContain('task split and order');

      // Another list on the next call: its ids, not the first list's.
      const other: ActiveList = {
        number: 102,
        areas: { plan: [{ id: 'invented_plan', label: 'Invented', means: 'An invented meaning.' }], implementation: [], cleanup: [] },
        rule: 'An invented rule.',
        validity: {},
      };
      await client(batch, other).catch(() => {});
      expect(requests[1].system).toContain('invented_plan: An invented meaning.');
      expect(requests[1].system).not.toContain('task_split');
      expect(JSON.stringify(requests[1].output_config.format.schema)).not.toContain('code_facts');
    });
  });

  test("a plan batch's prompt and schema hold only plan ids, and an implementation batch's only its own", async () => {
    const active = list(imported(fixture('report-v5')));
    const reply = JSON.stringify({ labels: [] });
    await withStandIn(reply, 'end_turn', async (requests) => {
      const client = anthropicLabelClient(MODEL);
      await client([{ id: 'f1', area: 'plan', text: 'An invented finding.' }], active);
      await client([{ id: 'f1', area: 'implementation', text: 'An invented finding.' }], active);
      const [plan, implementation] = requests.map((r) => ({
        system: r.system as string,
        schema: JSON.stringify(r.output_config.format.schema),
      }));
      for (const { id } of active.areas.plan) {
        expect(plan!.schema).toContain(`"${id}"`);
        expect(plan!.system).toContain(`${id}: `);
        expect(implementation!.schema).not.toContain(`"${id}"`);
        expect(implementation!.system).not.toContain(`${id}: `);
      }
      for (const { id } of active.areas.implementation) {
        expect(plan!.schema).not.toContain(`"${id}"`);
        expect(plan!.system).not.toContain(`${id}: `);
        expect(implementation!.schema).toContain(`"${id}"`);
      }
    });
  });
});

describe('labellerSettings', () => {
  test('is null with no key', () => {
    expect(labellerSettings({})).toBeNull();
    expect(labellerSettings({ ANTHROPIC_API_KEY: '' })).toBeNull();
  });

  test('defaults the model and the daily max', () => {
    expect(labellerSettings({ ANTHROPIC_API_KEY: 'k' })).toEqual({ model: 'claude-haiku-5-5', dailyMax: 500 });
  });

  test(".env.example's empty values mean the defaults", () => {
    expect(labellerSettings({ ANTHROPIC_API_KEY: 'k', LABELLER_MODEL: '', LABELLER_DAILY_MAX: '' })).toEqual({
      model: 'claude-haiku-5-5',
      dailyMax: 500,
    });
  });

  test("a daily max that isn't a positive whole number means the default", () => {
    for (const max of ['lots', '-3', '0', '2.5']) {
      expect(labellerSettings({ ANTHROPIC_API_KEY: 'k', LABELLER_DAILY_MAX: max })?.dailyMax).toBe(500);
    }
  });

  test('reads the model and the daily max', () => {
    const env = { ANTHROPIC_API_KEY: 'k', LABELLER_MODEL: 'claude-other', LABELLER_DAILY_MAX: '40' };
    expect(labellerSettings(env)).toEqual({ model: 'claude-other', dailyMax: 40 });
  });
});
