# Step tokens: unknown until a dispatch carries models

Finding F17 of the F31/F32 run (ledger `2026-11-17-claude-server-f31-f32.md`), from the ui kit's "zero, empty and
unknown" checklist line.

## Intent

Since F31, a step kind's cost on the Steps page is null until one of its dispatched models has a price. Its tokens
still start at zeros, so a kind with no dispatch carrying `models` reads "0.0" tokens, a known zero, beside a "–" cost.
On the dev:fixtures data, Final fix-check (ran 1, no dispatch) and Kit review (ran 0) show that.

## Goals

- A step kind's `tokens` (`StepRow`, `packages/shared/src/api/steps.ts`) is null until one of the kind's dispatches
  carries `models`, then the sum of every dispatched model's tokens, priced or not. Simplify's stays null, as today.
- The Steps page shows the dash for those kinds through the existing `Num`, with no web code change.

## Non-goals

- A kind with no dispatch at all keeping a known zero spend (direction (b), not picked).
- `modelsCost` giving 0 for a run or session with no priced model (a separate follow-up).
- The pair dispatches `stepSums` counts (issue #37).

## Anti-goals

- check:real must not report a step difference that isn't there: the reporter's scoreboard writes zeros where the
  dashboard now writes null, so check:real reads null tokens as zeros on both sides, as it does a null cost.

## Approaches

- **(a) Null until a dispatch carries `models` (picked by the owner).** Tokens and cost read alike for a kind with no
  spend facts, whether it had no dispatch or dispatches without `models`.
- **(b) A kind with no dispatch has zero spend.** Its cost reads 0.00. A kind whose dispatches lack `models` would
  still pair "0.0" tokens with the dash.

## Decided

- Tokens become known at the first dispatch with a non-null `models`, even an empty one or one whose models have no
  price: the reporter read the dispatch's models. Cost becomes known only when a model has a price, as today. So a kind
  can show tokens with a "–" cost (unpriced models), never "0.0" tokens with no models read.
- check:real's steps line drops its "tokens null on one side only" condition: with null read as zeros on both sides,
  simplify (null on both) still agrees, and a kind the dashboard leaves null agrees with the reporter's zeros.

## UI (the ui kit's points)

- **Question:** unchanged: what each step kind ran, found and cost over the period.
- **Screens changed:** `/steps` (the tokens cell of a kind with no dispatch carrying `models` reads the dash).
- **States and widths:** unchanged (empty, loading, error; 375, 768 and 1440 px).
- **Components:** existing only: `Num`/`Unknown` for the tokens cell, which already maps null to the dash.
- **Mockup:** none rendered (my call): a one-cell text change on an existing component; the kit reviewer's reference
  is this spec and the current Steps baselines.

## Left to the builder

- The invented web fixture's idle rows (`packages/web/src/test/steps.ts`) and the server tests that expect zeros.
- The `## Code conventions` line on a step kind's cost, which gains the tokens rule.
