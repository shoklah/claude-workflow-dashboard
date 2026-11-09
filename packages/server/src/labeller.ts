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

/** The labeller's settings from the data folder's `.env`, or null with no key, which turns the labeller off. */
export function labellerSettings(env: Record<string, string | undefined>): { model: string; dailyMax: number } | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  return { model: env.LABELLER_MODEL || 'claude-haiku-5-5', dailyMax: Number(env.LABELLER_DAILY_MAX || 500) };
}

/**
 * Labels the findings with no label from the model, in batches, up to the daily max. A result whose category isn't in
 * its finding's area, or whose id wasn't sent or was answered already, is dropped. A throwing client stops the run with
 * nothing stored from its batch, so the queue logs it and the next import retries.
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
    const reply = await client([...batch].map(([id, { area, text }]) => ({ id, area, text })));
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
 * fixed message, since the parser's own message quotes the reply, which holds finding text.
 */
export function anthropicLabelClient(model: string): LabelClient {
  const client = new Anthropic();
  return async (batch) => {
    let response;
    try {
      response = await client.messages.parse({
        model,
        max_tokens: 4096,
        system: SYSTEM,
        messages: [{ role: 'user', content: JSON.stringify(batch) }],
        output_config: { format: zodOutputFormat(LabelsSchema) },
      });
    } catch (error) {
      if (error instanceof Anthropic.AnthropicError && !(error instanceof Anthropic.APIError)) {
        throw new Error("the labeller's reply did not parse");
      }
      throw error;
    }
    if (!response.parsed_output) throw new Error("the labeller's reply did not parse");
    return {
      results: response.parsed_output.labels,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  };
}
