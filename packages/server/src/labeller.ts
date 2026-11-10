import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { AREAS, CATEGORIES, RELEVANCE, type Area, type Relevance } from '@cwd/shared';
import { labelInputs, labelledOn, pendingInputs, saveBatch, type StoredLabel } from './db/labels.ts';
import type { Db } from './db/open.ts';
import { listUnits } from './db/read.ts';

/** Labels a batch of findings, each under its id in the batch, and says the tokens it used. */
export type LabelClient = (batch: { id: string; area: Area; text: string }[]) => Promise<{
  results: { id: string; category: string; relevance: Relevance; reason: string }[];
  inputTokens: number;
  outputTokens: number;
}>;

const BATCH = 25;
const DAILY_MAX = 500;

/** A label client's failure whose message is fixed, with no finding text and no key, so labelPending logs it. */
export class LabelError extends Error {}

/**
 * The labeller's settings from the data folder's `.env`, or null with no key, which turns the labeller off. A daily max
 * that isn't a positive whole number means the default.
 */
export function labellerSettings(env: Record<string, string | undefined>): { model: string; dailyMax: number } | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  const max = Number(env.LABELLER_DAILY_MAX);
  const dailyMax = Number.isInteger(max) && max > 0 ? max : DAILY_MAX;
  return { model: env.LABELLER_MODEL || 'claude-haiku-5-5', dailyMax };
}

/**
 * Labels the findings with no label from the model, in batches, up to the daily max. A result whose category isn't in
 * its finding's area, or whose id wasn't sent or was answered already, is dropped. A batch whose client throws stores
 * nothing and is logged, as a LabelError's message or else the error's name, since another error's text can quote the
 * findings; the next batches still go, and the next import retries it.
 */
export async function labelPending(
  db: Db,
  client: LabelClient,
  settings: { model: string; dailyMax: number },
  now: Date,
): Promise<void> {
  const left = settings.dailyMax - labelledOn(db, now);
  const pending = pendingInputs(db, labelInputs(listUnits(db, 'run')), settings.model).slice(0, Math.max(0, left));
  for (let start = 0; start < pending.length; start += BATCH) {
    const batch = new Map(pending.slice(start, start + BATCH).map((input, n) => [`f${n + 1}`, input]));
    let reply;
    try {
      reply = await client([...batch].map(([id, { area, text }]) => ({ id, area, text })));
    } catch (error) {
      const kind = error instanceof Error ? error.name : 'unknown';
      console.error('label batch failed:', error instanceof LabelError ? error.message : kind);
      continue;
    }
    const labels = new Map<string, StoredLabel>();
    for (const { id, category, relevance, reason } of reply.results) {
      const input = batch.get(id);
      if (!input || labels.has(id) || !CATEGORIES[input.area].includes(category)) continue;
      const { runKey, findingId, hash } = input;
      labels.set(id, { runKey, findingId, hash, model: settings.model, category, relevance, reason, labelledAt: now });
    }
    saveBatch(db, [...labels.values()], { at: now, inputTokens: reply.inputTokens, outputTokens: reply.outputTokens });
  }
}

const EVERY_CATEGORY = [...new Set(AREAS.flatMap((area) => CATEGORIES[area]))] as [string, ...string[]];

const LabelsSchema = z.object({
  labels: z.array(
    z.object({ id: z.string(), category: z.enum(EVERY_CATEGORY), relevance: z.enum(RELEVANCE), reason: z.string() }),
  ),
});

const SYSTEM = [
  'Each finding you are given comes from a code review step in an agentic workflow.',
  'It comes as JSON with its id, its area and its text.',
  "For each finding, pick one category from its area's list below.",
  "Judge whether it was a real problem worth raising (valid), not one (invalid), or you can't tell (unclear).",
  'Give a reason in one sentence.',
  'Answer once for each finding, under its id.',
  '',
  ...AREAS.map((area) => `${area}: ${CATEGORIES[area].join(', ')}`),
].join('\n');

/**
 * The label client over the Anthropic API, with the key from `ANTHROPIC_API_KEY`. A reply that doesn't parse throws a
 * LabelError naming its stop reason, never the parser's own message, which quotes the reply, which holds finding text.
 */
export function anthropicLabelClient(model: string): LabelClient {
  const client = new Anthropic();
  const format = zodOutputFormat(LabelsSchema);
  return async (batch) => {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(batch) }],
      output_config: { format },
    });
    let parsed;
    try {
      parsed = format.parse(response.content.find((block) => block.type === 'text')?.text ?? '');
    } catch {
      throw new LabelError(`the labeller's reply did not parse (stop reason: ${response.stop_reason})`);
    }
    return {
      results: parsed.labels,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  };
}
