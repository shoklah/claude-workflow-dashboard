# Lists of items: a first glance, sorting, pages of 10 and rows that open

Status: approved by the owner, 2026-11-17. Captures: `docs/design/2026-11-17-tables/`, taken from the throwaway mock on `claude/tables-mock` (never merged). Written against `main` at `ba8cdd0`.

## Intent

The owner finds the findings table unreadable: twelve columns, most of them empty for most rows, crowd the summary, and a long run's 42 problems and 6 strengths take about two screens. The same shape repeats on every list of items: Runs (12 columns), Sessions (14), Context's runs and sessions (14), each a wide row of facts read only now and then, with no way to order or shorten it.

The owner reads findings to learn what goes wrong in planning and implementation, what goes well, and what reviewers catch. The first glance is what a finding says, then the app's verdict on it and its validity. The rest is read later, or used to sort through the list.

The question every list answers: which items are here, and which one do I want to open?

## Goals

- Each list shows a short first glance per row. Its other facts sit in a row that opens in place, with the empty ones left out.
- Clicking a column's header sorts the list by that column.
- A list longer than 10 rows shows 10 at a time, with the range and Previous and Next under it.
- On a narrow list, nothing of the first glance hides behind a sideways scroll. The summary wraps, and the columns marked narrow move to the top of the opened row.
- All of this is one component, `DataList`, that every list of items uses, the Work page's lists later included.

## Non-goals

- Summary tables (Weeks, Steps and rules, Skills, Models, Spend, Home's "This week", the heatmaps, the run page's agents and skills, Left for later, the step detail): they stay as they are, and a later design takes them up if needed.
- Header padding and spacing on other tables, which the owner noticed and set aside.
- The Work page itself. Its spec (`2026-11-17-work-page-design.md`) lists runs and sessions per goal and change. Its plan builds those lists on `DataList` once this slice is merged, and its pages of 10 come from here.
- Search, saved sorts, sorting by several columns, column pickers, a page-size choice.
- Changing what any list holds: the same rows and facts as today, each moved into either the first glance or the opened row.

## Anti-goals

- A fact on the first glance that is empty for most rows.
- A row that holds the same fact twice, once on the first glance and again in the opened row, at the same width.
- A second version of a list for phones: the same `DataList` folds its narrow columns into the opened row.

## Constraints

- The data rules hold as for every page: every value already comes through the API's views, and this slice adds no API field and no backend change.
- `DESIGN.md` is the look: glass table containers, pill buttons, muted secondary ink only on a panel.
- The kit's floor and the app's e2e checks: every page fits from 375 px, axe passes in light and dark, and screen baselines are updated.
- TanStack Table 9 is already the app's table library (`@tanstack/react-table` 9.3.1). Sorting and pages use its features, never code of our own.

## Approaches

1. **One shared `DataList` with first-glance columns, sorting, pages and an opened row (chosen).** Each list states its columns, the facts its opened row shows and which columns fold when narrow, and `DataList` does the rest. The mock shows it on every list in scope.
2. **Keep each table and add sorting and pages to each.** Smaller per table, but the 12 to 14 columns stay, and each table grows its own sort and page code. That is the duplication the reuse rule forbids, and it doesn't fix the crowding the owner complained about.
3. **Cards instead of rows on narrow screens.** It adds a second layout per list, which the anti-goals rule out, while folding columns into the opened row reads well at 375 px in the captures.

## Decisions the owner made

1. The findings' first glance is #, Summary, App, Valid, with the summary first (variant A, chosen over B, which put the verdicts first). Everything else goes in the opened row: step, task, severity, category, who labelled it, outcome, reason and fix-check verdicts, plus Run and Project on the Findings page, whose first column is Run.
2. A row's other facts open in place, below the row (option A, over a side panel or a dialog). Empty facts are left out.
3. A list longer than 10 rows shows 10 at a time, with "N–M of T" and Previous and Next under the table. A list of 10 or fewer has no controls. A filter or a step selection returns the list to its first page. The Work page's lists use the same control.
4. A list is ordered by clicking a header (option C): ascending, then descending, then back to the list's own order. The sort covers every row, not just the page, and goes back to page 1. With no sort, the list keeps its order from today.
5. The scope is lists of items: findings and strengths (run page and Findings page), Runs, Sessions, Context's runs and sessions, and Compliance's warnings, and the Work page's lists (its goal sections' and the goal page's changes, a change's or goal's sessions). Summary tables are left as they are.
6. First glances, approved on the mock:
   - Runs: Run (its title, else its branch), Project, Path, Finished, Found, Est. cost ($), Warnings.
   - Sessions: Session, Project, Started, Length, Est. cost ($), Warnings. The opened row holds its facts, then its timeline.
   - Context: Name, Kind, When, Past the cap, Largest, Read share.
   - Compliance's warnings: their columns as today, with sorting and pages added.
7. On small screens nothing of the first glance hides behind a sideways scroll. The summary wraps, and a list moves the columns marked narrow into the top of the opened row.
8. The list mock looks right (2026-11-17).

## The design

### The first glance and the opened row (`tables-run-*`, `tables-findings-*`, `tables-runs-*`, `tables-sessions-*`, `tables-context-*`, `tables-compliance-*`)

A list is one glass table container. Its first column that doesn't fold (the findings' # on the Findings page, after Run) starts with the row's toggle: a chevron, then the row's name. When the name is plain text (a finding's or strength's id, a session's title) the toggle is `RowToggle`, the name underlined as its link. When the first cell is already a link (a run's branch through `RunLink`), the chevron is a button of its own before it, named "Details of <name>", so a link never sits inside a button.

The opened row is one full-width row under it, indented to the name, holding the row's facts as `Pairs text`, empty ones left out, at most 3xl wide. Sessions add the session's timeline under the pairs, in a box that scrolls on its own, so the timeline never widens the table. Rows open and close independently, any number at once: a set, as the findings do in the mock. Strengths, which open one at a time in the mock, follow the same rule.

The findings' opened row: Step, Task, Severity, Category, Labelled by, Outcome, Reason, and one line per fix round ("Fix round 1": its verdict through `verdictLabel`), then Project on the Findings page. The outcome shows through `outcomeLabel`, a breakdown never joined into one string. The mock joins the verdicts into one line; the build doesn't.

Strengths: #, Summary, Category on the first glance; their step and task in the opened row.

### Sorting

Every first-glance column's header is a button (`SortHead`): its label and an arrow icon, which is muted while the list isn't sorted by that column. On a numeric column the arrow sits left of the label, so the label stays flush right over its numbers. Clicks cycle ascending, descending, then the list's own order. The header carries `aria-sort` while sorted. Text sorts alphanumerically (F2 before F10), numbers and times by value, and a value not known sorts last either way. A sort goes back to page 1.

Only first-glance columns sort. Severity, which the owner wanted sorted by weight, is in the opened row, so the findings' Severity filter covers it.

### Pages

Under a list of more than 10 rows (`Pager`, right-aligned): "1–10 of 24", then Previous and Next as outline pills, each disabled at its end. The range is announced politely when it changes, inside a `nav` named "<list> pages". The pages count the rows left after the filters. A change of rows (a filter, the run page's step selection, a new import) returns the list to page 1.

### Narrow lists

A column marked narrow shows only while the list's own container is at least 768 px wide (a container query on `DataList`'s wrapper, Tailwind's `@3xl`). Below that it moves, in its order, to the top of the opened row, and every row gets the toggle, even in a list with no other details (Compliance's Project). The fold follows the list's own width, not the window's, because from 768 px the rail takes about 260 px. Measured on the mock, whose fold follows the window, Runs still scrolls sideways by 279 px at a 768 px window and 23 px at 1024, Sessions by 214 px at 768, and Context's units by 277 px at 768. The narrow columns:

- Runs: Project, Path, Finished, Est. cost ($). First glance when narrow: Run, Found, Warnings.
- Sessions: Project, Started, Est. cost ($). First glance when narrow: Session, Length, Warnings.
- Context: Kind, When, Largest, Read share. First glance when narrow: Name, Past the cap.
- Compliance: Project, Since you last looked (the owner's call at build, 2026-11-18: at 375 px the list scrolled sideways by 65 px with it). First glance when narrow: Run, Warning.
- Findings on the Findings page: Run. On the run page nothing folds: #, Summary, App, Valid fit at 375 px (`tables-findings-375-*`, `tables-run-375-*`).

The summary or warning column is the one that takes the room and wraps (`wide`). The others keep their content's width.

### At each width

- 1440 px: every column shows (`*-1440-*`).
- 768 px: the window shows the rail, and each list's container is under 768 px, so its narrow columns fold.
- 375 px: as at 768, with the summary wrapping (`*-375-*`). No list region scrolls sideways at any of the three widths.

### States

- Empty: the list's own empty line in one row spanning the columns, as today ("No findings.", or the filtered "No findings match these filters…").
- Loading and error: the page's existing `State`, unchanged. `DataList` doesn't fetch.

## Screens

`/runs`, `/runs/97d6367dec7d9739`, `/findings`, `/sessions`, `/context`, `/compliance`.

## Components

- `DataList` (`components/DataList.tsx`), **new**. One list of items: its columns (id, header, the value it sorts by, its cell, numeric, wide, narrow), the opened row's facts, an optional `extra` under them, the row's key and name, its label and its empty line. No existing component sorts, pages or folds. Today's tables each write their own rows, which is the duplication this replaces.
- `SortHead` and `Pager` (beside `DataList`), **new**, with `PAGE_SIZE` = 10. `Pager` is exported, so the Work page's lists can use it if they need to.
- `RowToggle`, **existing**. It is the toggle of a `DataList` whose first cell is plain text.
- `Pairs text`, `EmptyRow`, `Num`, `NUM`, shadcn's `Table`, all **existing**.
- `FindingsTable` and `StrengthsTable` (`runs/`), **adapted**. They keep their filters and headings and render through `DataList`, passing it the filtered rows.
- `RunsTable`, `SessionsTable`, Context's `ContextUnits` and Compliance's warning list, **adapted** onto `DataList`.

The mock's `?long` padding and `?variant=b` are mock-only and are not built.

## What changes outside the components

- `CLAUDE.md`: a new line for `DataList` as the one list of items, and the `RowToggle` line extended with `DataList`'s toggle (recorded with this spec).
- Stories: `DataList` gets empty, full, long (pages), sorted and opened stories, with interaction tests for sorting, paging and opening. The adapted tables' stories follow their new first glance.
- e2e: `shell.spec.ts` already checks every page at 375, 768 and 1440 px. It gains the check that no list's region scrolls sideways at those widths. The screen baselines of the six screens are updated.

## Left to the builder

- Where the folded columns' terms come from: their headers, as in the mock.
- The exact spacing of the opened row's indent, matching `RowToggle`'s chevron.

## My calls, accepted by the owner

- The fold follows the list's width, not the window's (the measurements above). The 1440 and 375 captures are unchanged by it, since at 1440 every list is wider than 768 px and at 375 each is narrower.
- Two forms of toggle: `RowToggle` where the name is text, a chevron button where the first cell is a link.
- Fix-check verdicts as one line per round, not the mock's joined line.
- Severity has no sort, since it isn't on the first glance.
