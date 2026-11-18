# Home's feed items: the message first

A small change to `Item` in `packages/web/src/home/Feed.tsx`. The approved mockup is in `docs/design/2026-11-18-feed-items/` (option A, the feed panel at 1440 and 375 px, dark and light).

## Intent

The owner wants the feed's items easier to read, with more focus on the warning itself. Today the heaviest text in an item is its status word ("New warning", bold), then the run's underlined title. The warning's text comes last, at body weight.

## Approaches

Three layouts were rendered on invented data in the feed's 288 px column and at 375 px, beside today's:

- **A, caption on top (picked):** the status and time become a small muted caption, the message follows in medium weight, and the context sits small under it. It keeps newest-first order and the swatch beside its word.
- **B, message leads:** the swatch sits beside the message, and the status word and time trail at the foot. It puts the most focus on the message, but "New warning" at every item's foot reads as noise, and the swatch sits far from its word.
- **C, grouped by kind:** warnings, then finished runs, under one heading each. It is the most compact, but it gives up newest-first order across kinds and changes DESIGN.md's feed rule.

## The design

An item, top to bottom:

1. **Caption**, small (`text-xs`) and muted: the status swatch, its word ("New warning", "Run finished") and, at the row's end, the time.
2. **Message**, body size in medium weight (`font-medium`) and primary ink: a warning's text (through `WarningText`), or a finished run's title opening the run (`RunLink`).
3. **Context**, small and muted: a warning's run (its `RunLink`, else its branch) or its session's chip line, then the project and path ("tidepool-api, Full path").
4. **A finished run's facts**: the same five pairs (Findings, Acted on, Open, Time, Est. cost) on one wrapping row (`Pairs inline="beside"`), small.

Unchanged: the newest-first order, the swatch beside its word, the panel, its "Mark all seen" icon, its empty line and its list's scroll region.

## Spec points (ui kit)

- **Question:** what happened since I last looked, and what needs my attention?
- **States:** empty is unchanged ("Nothing new..."); loading and error are Home's own.
- **Widths:** from `lg` (1440), the 288 px column beside the page; at 768 and 375, the feed stacks under the page at full width, its list scrolling in its own region at most 24 rem tall; text wraps, with no sideways scroll.
- **Screens:** `/`.
- **Components:** `Item` adapted; `RunLink`, `Pairs` (`inline="beside"`), `Time`, `Num` and `SessionChip` existing; `WarningText` adapted: it takes a class for its text, so the feed sets the message's weight without changing the session line.

## Left to the builder

Spacing within the item follows the mockup (`gap-1` between lines, `gap-x-4` between facts). The code convention on feed items gains the reading order.
