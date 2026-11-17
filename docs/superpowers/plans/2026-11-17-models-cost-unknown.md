# F27: an unpriced run's cost is unknown — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `modelsCost` is null until a priced entry, so an all-unpriced run or session shows the dash, not "$0.00".

**Architecture:** `addKnown` moves from `packages/server/src/views/home.ts` to `packages/shared/src/facts.ts`;
`modelsCost` folds its entries' costs with it. check:real's week line reads a null cost as 0 on both sides, as the
reporter writes 0.0 for a week of unpriced runs.

**Tech Stack:** TypeScript, Vitest, Playwright (screens in the container).

**Spec:** `docs/superpowers/specs/2026-11-17-models-cost-unknown-design.md`

## Global Constraints

- Follow the repo's `CLAUDE.md` code conventions (relative imports with `.ts`, `import type`, erasable-only TS).
- Fixtures are invented; no fixture `totals` change.
- `packages/server/src/views/steps.ts` is also being edited by a sibling session (F17); this plan touches only its
  `addKnown` import line there.

## Review Focus

- A `models` map with some priced and some unpriced entries: the priced sum, not null (Task 1's test).
- An empty `models` map `{}`: null, since no entry is priced (Task 1's test).
- A week whose runs with `models` are all unpriced: `weekSums` gives null, check:real doesn't report it (Tasks 1, 2).
- A session with all-unpriced models: the Sessions view's cost is null (a pass-through of `modelsCost`; Task 1's facts test).

---

### Task 1: `modelsCost` null until a priced entry

**Kit:** exempt: a text-only change of one cell on existing components (`Num` already shows null as the dash); the runs screens are still regenerated and every screen checked.

**Files:**
- Modify: `packages/shared/src/facts.ts` (add `addKnown`, change `modelsCost` and its doc comment, and the
  `runFacts` comment `// cost: modelsCost, null when models is null (no window).`)
- Modify: `packages/shared/src/api/weeks.ts` (`WeekRow`'s cost doc: null when no run has a priced model)
- Modify: `packages/server/src/views/home.ts` (drop `addKnown`, import it from `@cwd/shared`)
- Modify: `packages/server/src/views/steps.ts` (import line only: `addKnown` from `@cwd/shared`, not `./home.ts`)
- Modify: `CLAUDE.md` (the `modelsCost` line and the step-cost line)
- Test: `packages/shared/test/facts.test.ts`, `packages/server/test/runs.test.ts`, `packages/server/test/home.test.ts`
- Screens: `packages/web/e2e/runs.screens.ts-snapshots/` (regenerated)

**Interfaces:**
- Produces: `export const addKnown = (sum: number | null, value: number | null | undefined): number | null` in
  `packages/shared/src/facts.ts`, exported through `@cwd/shared`; unchanged behaviour ("a sum of known values: null
  until one is known").
- Produces: `modelsCost(models: RunEntry['models']): number | null`: null with no map or no priced entry, else the
  priced sum.

- [ ] **Step 1: Write the failing tests**

`facts.test.ts`: rename `'cost is 0 when no model is priced'` to `'cost is null when no model is priced'` and expect
`runFacts(run('plan')).cost` `toBeNull()`; replace the `modelsCost` test with:

```ts
test("sums a models map's priced costs, null with none priced or no map", () => {
  const tokens = { input: 1, output: 1, cache_read: 0, cache_write: 0 };
  expect(modelsCost({ a: { ...tokens, cost: 0.24 }, b: { ...tokens, cost: null }, c: { ...tokens, cost: 1 } })).toBeCloseTo(1.24);
  expect(modelsCost({ a: { ...tokens, cost: null } })).toBeNull();
  expect(modelsCost({})).toBeNull();
  expect(modelsCost({ a: { ...tokens, cost: 0 } })).toBe(0);
  expect(modelsCost(null)).toBeNull();
});
```

`runs.test.ts`: in the test that reads `(await run(PLAN)).models`, also expect `(await run(PLAN)).facts.cost` to be
`null`.

`home.test.ts`: in "findings and cost sum the week's runs", the comment reads "The plan record's models have no price
(cost unknown)"; add a test "a week of only unpriced runs has a null cost": from `fixture('report-full')`, set every
model's `cost` to null on the runs dated `>= '2026-11-08'`, and expect `thisWeek.cost` and `thisWeek.costPerRun` null.


- [ ] **Step 2: Run them to see them fail**

Run: `pnpm vitest run packages/shared/test/facts.test.ts packages/server/test/runs.test.ts packages/server/test/home.test.ts`
Expected: FAIL on the null expectations (got 0).

- [ ] **Step 3: Implement**

Move `addKnown` with its comment into `facts.ts`; `modelsCost` becomes
`models ? Object.values(models).reduce<number | null>((sum, m) => addKnown(sum, m.cost), null) : null`. Update its doc
comment and `runFacts`' cost comment to say null with no map or no priced model. `home.ts` and `steps.ts` import
`addKnown` from `@cwd/shared`.

- [ ] **Step 4: Run the tests and type check**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: CLAUDE.md**

- `modelsCost` line: "(null with no map or no priced entry, else its priced entries' sum, through `addKnown`)".
- Step-cost line: `addKnown` is "in `packages/shared/src/facts.ts`" and "(the one sum that stays null until a value is
  known, `weekSums`' and `modelsCost`' too)"; drop ", unlike `modelsCost`, which gives 0 when no model is priced".

- [ ] **Step 6: Regenerate the runs screens**

Run: `pnpm build && pnpm test:screens --update-snapshots --workers=1 e2e/runs.screens.ts`, then `pnpm test:screens`.
Expected: only `runs.png` (light and dark) changes, with the plan run's cost cell now the dash; every screen passes.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "fix: modelsCost is null until a priced model (F27)"
```

### Task 2: check:real reads a null week cost as 0

**Files:**
- Modify: `packages/server/src/check-real.ts` (the week comparison `cents(sum.cost) !== cents(week.cost)` and its
  comment)
- Modify: `CLAUDE.md` (the check:real "compares each page's sum" line)
- Test: `packages/server/test/check-real.test.ts`

**Interfaces:** none new.

- [ ] **Step 1: Write the failing test**

"check:real reads an unpriced week's null cost as the reporter's 0": the committed fixture `report-projects` already
has week `2026-11-08` holding only the unpriced plan run, with the reporter's `cost` 0; expect
`checkReal(['cat', fixturePath('report-projects')]).stdout` to contain `'weeks: 4 compared, 0 differ\n'`.

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run packages/server/test/check-real.test.ts`
Expected: FAIL with `weeks: 4 compared, 1 differ` (it passes before Task 1, since the plan run costs 0 there).

- [ ] **Step 3: Implement**

Compare `cents(sum.cost ?? 0) !== cents(week.cost ?? 0)`; the comment says the cost is read as 0 when null on both
sides, since the reporter writes 0.0 where the dashboard writes null.

- [ ] **Step 4: Run it to see it pass**

Run: `pnpm vitest run packages/server/test/check-real.test.ts`
Expected: PASS.

- [ ] **Step 5: CLAUDE.md**

In the check:real line "a cost to the cent and a share to 0.01 points", add "(a week's cost, as a step's, with a null
read as 0 on both sides)".

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "fix: check:real reads an unpriced week's cost as the reporter's 0"
```
