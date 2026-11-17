# Step tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A step kind's tokens read unknown until one of its dispatches carries `models`, as its cost already does.

**Architecture:** `stepSums` (`packages/server/src/views/steps.ts`) starts every row's `tokens` at null and fills zeros at the first dispatch with `models`. check:real reads null tokens as the reporter's zeros. The web app changes no code: only its invented fixture, one story line and the Steps baselines.

**Tech Stack:** TypeScript, Vitest, Storybook (chromium), Playwright in the screens container.

**Spec:** `docs/superpowers/specs/2026-11-17-step-tokens-design.md`

## Global Constraints

- A step kind's `tokens` is null until one of its dispatches has a non-null `models` (an empty or unpriced one counts); then each token label sums every model's count, a missing one 0. Simplify's stays null. Cost is unchanged (null until a priced model).
- check:real's steps compare drops `(row.tokens === null) !== (want.tokens == null)`; `sameCounts(row.tokens, want.tokens)` already reads null as zeros (`keysOf` and `?? 0`).
- Invented data only; CLAUDE.md's Code conventions line on a step kind's cost already states the tokens rule.

## Review Focus

- A kind with no dispatch: tokens null. A kind whose only dispatch has `models: { a: { input: 10, cost: null } }`: tokens `{ input: 10, output: 0, cache_read: 0, cache_write: 0 }`, cost null.
- Simplify: tokens null even when a dispatch of kind `simplify` carries `models`.
- check:real's `steps: 8 compared, 0 differ` on the fixtures, where the reporter writes zeros for kinds the dashboard now leaves null.

---

### Task 1: A step kind's tokens are null until a dispatch carries models

**Files:**
- Modify: `packages/server/src/views/steps.ts` (`stepSums`: the row's initial `tokens`, the dispatch loop's guard, the doc comment)
- Modify: `packages/server/src/check-real.ts:168` (drop the null-on-one-side condition)
- Modify: `packages/shared/src/api/steps.ts:4-8` (`StepRow`'s comment)
- Modify (invented): `packages/web/src/test/steps.ts` (`idle()`'s tokens null; drop `NO_TOKENS` if unused), `packages/web/src/steps/StepsPage.stories.tsx:67` (`'0.0'` becomes `DASH`)
- Modify: the Steps screen baselines, light and dark (`packages/web/e2e/steps.screens.ts-snapshots/`)
- Test: `packages/server/test/steps.test.ts`

**Kit:** ui [react-tailwind-shadcn]
**Screens:** /steps

**Interfaces:**
- Produces: `stepSums(runs: RunEntry[]): StepRow[]`, unchanged signature; `StepRow.tokens` null for a kind with no dispatch carrying `models`.

- [ ] **Step 1: Write the failing tests** in `packages/server/test/steps.test.ts`:

  Extend the existing test "a step kind's cost is null until one of its dispatched models has a price, then the priced ones' sum" and rename it "a step kind's tokens are null until a dispatch carries models, and its cost until one has a price": the unpriced-only case expects `tokens` toEqual `{ input: 10, output: 0, cache_read: 0, cache_write: 0 }`; the loop over the other kinds also expects `r.tokens` toBeNull (simplify's included, so drop the simplify skip for tokens only); add `stepSums([{ schema: 2, dispatches: [{ kind: 'simplify', models: { a: { input: 3, cost: 1 } } }] }])` → simplify's row has `tokens` null and `cost` null.

  In `scoreRow`/`expectScoreboard`, compare tokens as the reporter's with null read as zeros: `scoreRow` leaves `tokens` out of its object, and `expectScoreboard` destructures `tokens` beside `cost` and checks, for every kind but simplify, `expect(tokens ?? { input: 0, output: 0, cache_read: 0, cache_write: 0 }).toEqual(board[row.step].tokens)`; simplify's stays `toBeNull()`.

- [ ] **Step 2: Run** `pnpm vitest run packages/server/test/steps.test.ts`. Expected: the extended test FAILS (tokens zeros, not null).

- [ ] **Step 3: Implement** in `stepSums`: rows start with `tokens: null`; in the dispatch loop the guard becomes `if (!row || row.step === 'simplify' || !dispatch.models) continue;`, then `const tokens = (row.tokens ??= zeros(TOKENS));` and the token sum adds into `tokens`. Update the doc comment: tokens null until a dispatch of the kind carries `models`. Update `StepRow`'s comment in `packages/shared/src/api/steps.ts` the same way.

- [ ] **Step 4: check:real.** Delete the line `(row.tokens === null) !== (want.tokens == null) ||` in the `steps` compare. Run `pnpm vitest run packages/server`. Expected: PASS, `check-real.test.ts`'s `steps: 8 compared, 0 differ` included.

- [ ] **Step 5: Invented web data.** `packages/web/src/test/steps.ts`: `idle()`'s `tokens` becomes `null` (remove `NO_TOKENS` if nothing else uses it). `StepsPage.stories.tsx:67`'s `'0.0'` becomes `DASH`. Run `pnpm -r typecheck && pnpm vitest run`. Expected: PASS.

- [ ] **Step 6: Screens.** In the background, `pnpm test:screens --update-snapshots --workers=1 e2e/steps.screens.ts`, then the full `pnpm test:screens` as the check. Expected: PASS both; the Steps baselines change (Final fix-check's and Kit review's tokens read the dash, light and dark).

- [ ] **Step 7: Commit** `fix: a step kind's tokens stay unknown until a dispatch carries models (F17)`, with the Steps baselines.
