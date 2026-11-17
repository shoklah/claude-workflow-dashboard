# Server fixes F31 and F32: an unknown step cost, and a skill outcome as one label

Two findings the UI slice's kit review left to the owner as server-side work (`F31`, `F32` in its run ledger).

## Intent

Each screen cell holds one known value, and an unknown one shows as the dash. Two server values break that today:

- **F31.** `stepSums` in `packages/server/src/views/steps.ts` sums `m.cost ?? 0` over a step kind's dispatches, so a step
  whose models have no price, or with no dispatch carrying `models`, reads "0.00" on the Steps page instead of the
  dash.
- **F32.** `skillOutcomeLabel` in `packages/server/src/views/runs.ts` writes an `{applied, skipped}` outcome as
  "applied 2, skipped 1": two counts in one cell on the run page and the Sessions timeline, and, on the Skills page,
  one outcome line per distinct pair of counts, since the label is the grouping key.

## Goals

- A step kind's cost is null until one of its dispatched models has a price; then it is the sum of the priced models'
  costs, as `modelsCost` and the Spend page treat an unpriced model. Simplify's stays null, as today.
- A counted outcome (a dict, today simplify's `{applied, skipped}`) gets one label by whether it produced anything, as
  the reporter's `skill_totals` groups it: **"found something"** when any count isn't 0, **"found nothing"** when every
  count is 0. Its counts leave the backend no more.

## Non-goals

- The reporter's per-skill names (`SKILL_OUTCOMES`: "spec", "plan", "record") for other outcomes; every other outcome's
  label stays as today.
- The pair dispatches the reporter leaves out of its step sums and `stepSums` doesn't (a separate follow-up).
- Any web layout change: the cells already show one value; only invented fixtures and stories change their text.

## Anti-goals

- check:real must not report a step difference that isn't there: the reporter's scoreboard writes 0.0 where the
  dashboard now writes null, so check:real reads a null cost as 0 on both sides (simplify's is null on both).

## Approaches

- **A. One label by whether it produced anything (picked by the owner).** Follows the reporter's `skill_totals`; the
  Skills page's lines collapse to two stable ones; the run page and timeline lose the per-load counts.
- **B. Applied and skipped as their own numeric fields.** Keeps every count, but grows the API, three pages and their
  stories for a figure only simplify has.

For F31 there was one sensible way, the owner's: null until a priced model, as `modelsCost`.

## Decided

- The labels are "found something" and "found nothing" (my call: they match the Steps page's "Found something" and
  stay true when only `skipped` is above 0, where "applied" would not).
- A dict outcome is "counted" when every value is a number; one with any other value stays "–", as an unknown shape
  does today. An empty dict `{}` is "found nothing", as the reporter's `any({}.values())` is false.

## UI (the ui kit's points)

- **Question:** unchanged per screen; only one cell's text changes.
- **Screens changed:** `/steps` (a step kind's cost cell reads the dash), `/runs/97d6367dec7d9739` (the invented Full
  run's skills), `/skills` (simplify's outcome lines), `/sessions` (a simplify load's outcome in the timeline).
- **States and widths:** unchanged (empty, loading, error; 375, 768 and 1440 px).
- **Components:** existing only: `Num`/`Unknown` for the cost cell, `Lines` on Skills, the run page's skills `Pairs`,
  the Sessions timeline.
- **Mockup:** none rendered (my call): a text-only change on existing components; the kit reviewer's reference is
  this spec and the current screen baselines.

## Left to the builder

- Where the priced-model test lives (a flag per row, or a helper beside `modelsCost`), by the codebase's reuse rule.
- The invented fixtures, stories and tests that carry the old joined label or a 0 cost.
