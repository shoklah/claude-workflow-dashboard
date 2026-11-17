# F27: an unpriced run's cost is unknown, not $0.00

Follow-up F27 from the F31/F32 run's final review (PR #39), ruled to the owner.

## Intent

An unknown value shows as the dash. `modelsCost` in `packages/shared/src/facts.ts` gives null with no `models` map,
but otherwise sums `m.cost ?? 0`, so a run or session whose models all lack a price reads "$0.00". The invented
fixtures' plan run `feature/offline-sync` (two preview models, no price) is one: it reads "$0.00" on the Runs table, on
its run page and, if it were Home's latest finished run, in Home's feed. Step kinds already stay null until a priced
model, through `addKnown` in `packages/server/src/views/home.ts` (F31).

## Goals

- `modelsCost` is null with no map **or with no priced entry**, else the sum of its priced entries: `addKnown`'s rule.
- Its callers follow with no change of their own: `runFacts` (Runs table, run page, Home's feed, `weekSums`) and the
  Sessions view.
- `weekSums`' cost is then null for a week whose runs with `models` are all unpriced (already `addKnown`).

## Non-goals

- Home's `costPerRun` keeps dividing the week's cost by all its runs; a partly priced week stays the priced sum, as
  step costs and the Spend page are.
- The reporter's `windows_cost`, which gives 0.0 for such a run or week: this repo never edits the workflow repo.

## Anti-goals

- check:real must not report a week difference that isn't there: the reporter's `totals.weeks[].cost` is 0.0 where
  `weekSums` now gives null, so check:real's week line reads a null cost as 0 on both sides, as its step line does.
  Its phases line already reads a null `modelsCost` as 0.

## Approaches

- **(a) Null until a priced entry (picked by the owner).** One rule for every cost of models in the app; the unpriced
  run shows the dash.
- **(b) Keep 0.** Matches the reporter's `windows_cost`, but shows a known-looking "$0.00" for an unknown cost.

## Decided

- `modelsCost` reuses `addKnown`; since `addKnown` lives in the server's `views/home.ts` and `@cwd/shared` can't import
  the server, `addKnown` moves to `packages/shared/src/facts.ts` beside `modelsCost`, and `home.ts` and `steps.ts`
  import it from `@cwd/shared` (my call: reuse before writing; one helper for "null until known").
- The fixtures' `totals` keep the reporter's rules, so none changes: `report-projects`' week `2026-11-08` holds only
  the unpriced plan run and keeps the reporter's cost 0, which check:real then reads against `weekSums`' null.
- `CLAUDE.md`: the `modelsCost` line states the new rule, the step-cost line drops its contrast with `modelsCost` and
  names `addKnown`'s new home, and check:real's line says the week cost is compared with null read as 0.

## UI (the ui kit's points)

- **Question:** unchanged per screen; only one cell's text changes.
- **Screens changed:** `/runs` (the plan run's cost cell reads the dash), `/runs/<plan run>` (its "Est. cost" reads
  the dash). The run page's screenshot is the Full run's, so only `runs.png` (light and dark) is expected to change.
- **States and widths:** unchanged (empty, loading, error; 375, 768 and 1440 px).
- **Components:** existing only: `Num`/`Unknown` already render null as the dash read "not known".
- **Mockup:** none rendered (my call): a text-only change on existing components.

## Tests

- `facts.test.ts`: `modelsCost` of an all-unpriced map is null; a partly priced map is its priced sum; no map is null.
- `runs.test.ts`: the plan run's facts have `cost: null`.
- `home.test.ts`: the comment that calls the plan run's cost 0 says unknown; a week of only unpriced runs has a null
  cost.
- `check-real.test.ts`: `report-projects`' week of only the unpriced plan run, with the reporter's 0, doesn't differ.
- Screens: `runs.png` baselines regenerated in the container.
