# The side menu: sections, a full-height rail, the controls and a name

Status: approved by the owner, 2026-11-17. Captures: `docs/design/2026-11-17-menu/`. Written against `main` at `7f89636` (the UI slice's part 2 is merged).

## Intent

The shell's menu is one flat list of 11 links in a 176 px panel that scrolls away with the page, beside a header row that is nearly empty most of the time. The owner finds it too dense and wants it to carry more: named sections, icons, the full height of the window, the controls that today sit above the page, and the app's name. The app also gets that name here: **edward**.

The question the rail answers: where am I, where can I go, and is what I see fresh and safe to show?

## Goals

- The 11 pages sit in named sections, with air between sections.
- The rail fills the window's height and stays put while the page scrolls.
- Showing mode and Refresh live at the rail's foot, with the time of the last good import.
- From 768 px there is no header row: the page starts at the top, and the import banner appears above it only when it has something to say.
- Each entry has an icon; the rail's top carries edward's mark and wordmark.
- Under 768 px the Menu button and its dialog keep working, and every page still fits from 375 px.

## Non-goals

- Merging, dropping or renaming pages. The lookup done for this design found that each of the 11 pages holds facts no other shows; fewer pages is its own design.
- Renaming the repository, the README, the package names, the data folder (`~/Library/Application Support/claude-workflow-dashboard`), the launchd label or any local folder. That is its own task; the folder renames split run history, since the reporter keys runs by project path.
- Anything in the workflow repo. Its new name, **roland**, is recorded here only because the two names were chosen as a pair.
- An icons-only rail, collapsible sections, shorter page labels.
- Settling the name of the Workflow page planned for slice 3 (decision 22 of `2026-11-09-live-dashboard-design.md`), which the section named "Workflow" will clash with. That is slice 3's to settle, most likely by naming the page something else.
- Designing the phone layout beyond what is said here.

## Anti-goals

- A control (Refresh, showing mode) that a phone user has to open the menu to reach.
- A menu entry whose icon, colour or badge carries state. Icons are scan anchors only. The rail's only colour is the mark and, while showing mode is on, its amber bar.
- A second list of pages: the rail and the dialog render the same `Menu`.

## Constraints

- The stack is fixed. No new dependency: lucide comes with shadcn/ui, Outfit is a variable font (weights 300 and 700 are there), the dialog is the one installed.
- `DESIGN.md` rules hold: no panel inside a panel, secondary ink only on a panel, no `backdrop-filter`, hover changes instant, pills for buttons.
- The data rules are untouched: nothing here reads or shows new data. "Imported" shows `lastGoodImportAt`, which `/api/status` already returns.
- From 768 px, showing mode's bar stays on screen while it is on, at any scroll position and window height. Under 768 px the top row scrolls with the page as today (the owner's call: the phone layout has its own later review).

## Approaches

Three were rendered on the real components (`?variant=a|b|c` on the throwaway branch `claude/menu-mock`):

- **A, chosen: noun sections, the controls at the rail's foot.** The header row goes from 768 px; the import time sits with the button that changes it; showing mode's bar is on screen wherever the page is scrolled. Cost: the rail is wider, and showing mode's bar wraps.
- **B: the same with question names** ("What ran", "What it took", "How it behaved"). Warmer for a visitor, slower to scan. The owner picked nouns.
- **C: sections and icons, the controls left above the page.** The smallest change, but it keeps a row that is empty most of the time and leaves the rail's lower half bare. The owner picked the rail's foot.

How the rail stays put: `position: sticky` inside the shell's existing flex row, chosen over `position: fixed`, which would need the content column offset by the rail's width at every breakpoint.

## Decisions the owner made

- **Sections and order:** Home and Weeks first, as an unlabelled pair (the summary); then **Activity** (Runs, Sessions, Findings); **Usage and cost** (Context, Spend); **Workflow** (Compliance, Steps and rules, Skills, Models and advisor).
- **Section names are nouns.**
- **The rail fills the height and is static.**
- **Showing mode and Refresh go at the rail's foot.**
- **Icons on the entries.**
- **The app is named edward**, and the workflow roland. In a wordmark the name is lower-case with its hidden word in the bold weight (ed**ward**, ro**land**): the word says what each does. In prose "Edward" is fine.
- **The mark is the eye:** an outline eye whose pupil is two of the backdrop's orbs.
- **Page merging is a separate, later design.**
- **Under 768 px the top row is not pinned:** showing mode's bar scrolls with the page there, as today.

Confirmed in the grilling before approval:

- **The section stays "Workflow";** its clash with slice 3's Workflow page is slice 3's to settle.
- **"Imported <time>" always shows in the rail** once there is a good import, also while the banner gives the same time after a failed import: the line keeps one place in every state.
- **The eye stands as mocked,** and `DESIGN.md` gains the one line that lets the mark, and only the mark, use the orb colours.
- **Two names for a while:** the rail, the tab and the favicon say edward while the repo and README keep their name until the rename task, which follows as its own proposal. Nothing in the README changes here.
- **Landing order against the run page work:** no fixed order. Baseline images are never hand-merged: whichever branch merges second rebases onto `main` and regenerates its baselines in the container.
- **Refresh stays at the foot:** imports run on their own, so it is the rare case, and a failed import still shows in the banner above the page.
- **The full rail starts at 768 px,** at 224 px, as captured; one shell breakpoint as today.

## The design

### The rail, from 768 px (`menu-1440-*`, `menu-scrolled-1440-dark`, `menu-768-dark`)

A glass panel 224 px wide (today 176), 12 px from the window's left, top and bottom edges, as tall as the window less those margins. It sticks while the page scrolls. If the window is shorter than its content, the brand and the foot stay in place and the menu between them scrolls; the page never grows to fit the rail. So Refresh and showing mode's bar are on screen at any window height. (The mockup scrolls the whole rail; this is the one place the build differs from it.)

Top to bottom:

1. **The brand:** the mark at 24 px and the wordmark "edward" at 20 px, "ed" in weight 300 and "ward" in 700, tight tracking, primary ink. It is not a link (Home is the entry under it). The mark is decorative (`aria-hidden`); the wordmark is the text "edward".
2. **The menu** (`nav`, "Main"): four groups 24 px apart, entries 4 px apart inside a group. A named group shows its name above its entries in the small role (12 px, 500) in secondary ink, sentence case, aligned with the entries' icons. An entry is its icon (16 px, primary ink, `aria-hidden`) then its label; the current page is the lighter pill with 600 weight as today, the rest hover as today. An entry is current on the pages below it (Runs on a run's page), Home only on `/`.
3. **The foot**, pushed to the bottom, above a hairline: showing mode, then Refresh at the rail's full width, then "Imported Nov 12, 11:00" in the small role in secondary ink.

Icons (lucide), one per page, each a plain picture of its page's subject:

| Page | Icon | Page | Icon |
|---|---|---|---|
| Home | `House` | Spend | `CircleDollarSign` |
| Weeks | `CalendarDays` | Compliance | `ShieldCheck` |
| Runs | `Play` | Steps and rules | `ListChecks` |
| Sessions | `Terminal` | Skills | `Puzzle` |
| Findings | `SearchCheck` | Models and advisor | `Bot` |
| Context | `Gauge` | | |

What an icon earns: with sections, entries no longer sit in one scannable column of first letters, and an icon gives each a fixed shape to find. It never changes with state.

### The foot's states

- **Showing mode off:** the switch and its label, as today.
- **Showing mode on** (`menu-showing-1440-*`): the amber bar inside the rail, "Showing: <names>" wrapping as it needs, "Stop showing" under it at the bar's width.
- **Showing mode unreadable:** "Couldn't read showing mode." in place of the switch, as today.
- **Importing:** the button reads "Importing…" and is disabled, as today.
- **"Imported <time>"** shows `lastGoodImportAt` through `Time` in every state that has one, a failed import's included, and is absent until there is one (`menu-never-1440-light`).

### The banner, from 768 px (`menu-failed-1440-dark`, `menu-never-1440-light`)

The header row is gone. When the status has something to say (the last import failed, nothing imported yet, the server unreachable), the same `Banner` texts as today show above the page title, at the content column's width; otherwise nothing is there and the page title is the first thing in the column.

(`menu-never-1440-light` stubs only the status, so the page under the banner still shows fixture data; a real first start shows each page's empty state.)

### Under 768 px (`menu-375-*`, `menu-375-open-*`, `menu-failed-375-dark`)

The rail is hidden and the top row is as today: the Menu button, showing mode, Refresh, with the banner wrapping under them. So Refresh and showing mode stay one tap away. The "Imported" line is not shown there.

The Menu button's dialog shows the brand in place of the visible "Pages" title, then the same `Menu` with its sections and icons. Its accessible name stays "Pages". It closes on a followed link, Escape and its close button, as today, and scrolls inside itself on a short screen.

### At each width

- **1440 px:** as captured. The content column is 48 px narrower than today.
- **768 px:** the full rail (224 px) and no header row; Home's tiles tighten and its diagram scrolls in its own panel, as today.
- **375 px:** the top row and the dialog; the page is unchanged.

### The name elsewhere

- The browser tab's title becomes "edward" (`packages/web/index.html`).
- A favicon: the mark, as an SVG with fixed colours (the outline in ink for a light tab bar and white for a dark one).
- `DESIGN.md`'s name and title become edward.
- Nothing else is renamed (see Non-goals).

The mark's source as mocked is `docs/design/2026-11-17-menu/mark.svg`. Its two colours are the backdrop's pink and teal orbs, the same in both modes, and live as tokens in `index.css` like every other colour.

## Screens

Every page shares the shell. The paths the checks should look at: `/` and `/runs` (the rail, the foot, the banner region), at 375, 768 and 1440 px.

## Components

| Component | Where | Status |
|---|---|---|
| `Menu` | `layout/Menu.tsx` | Adapted: its entries become sections (a name or none, and entries with an icon), one list as today; renders groups. |
| `MenuButton` | `layout/Menu.tsx` | Adapted: the dialog shows `Brand`, its title "Pages" kept for screen readers only, and scrolls when taller than the screen. |
| `Brand` | `layout/` | New: the mark and wordmark. Nothing existing draws a logo. |
| `Shell` | `layout/Shell.tsx` | Adapted: the sticky full-height rail with brand, menu and foot; no header row from 768 px; the banner above `main`. |
| `ShowingControl` | `layout/ShowingControl.tsx` | Adapted: its "on" bar wraps in a narrow container. Its dialog and behaviour are unchanged. |
| `RefreshButton` | `layout/RefreshButton.tsx` | Adapted only as far as the rail's full width needs. |
| `Banner`, `StatusBanner`, `Time` | `layout/StatusBanner.tsx` | Existing. |
| `Dialog`, `Button`, `Switch` | `components/ui/` | Existing. |

## What changes outside the components

- **`DESIGN.md`:** the name; Layout (the rail's content and behaviour, no header row from 768 px, the top row under it); the Menu rail component line (sections, icons, brand, foot); Typography gains the wordmark (20 px, weights 300 and 700); a line under Colors or Do's and Don'ts allowing the mark, and only the mark, to use the backdrop's orb colours.
- **`CLAUDE.md`'s conventions:** the "every page fits the viewport" entry (the rail is sticky and full height; the top row exists only under 768 px); a new entry for the menu's sections as the one list of pages, and for `Brand` as the one place the name and mark are drawn.
- **Stories:** `Menu` (sections, the current page, a page below an entry), `Brand`, `Shell` (loading, server unreachable, never imported, failed import, imported, showing on), the Menu button's dialog.
- **`e2e/shell.spec.ts`:** keeps its checks at 375, 768 and 1440 px and the 11 links; gains that after scrolling a long page at 1440 px the rail's brand and Refresh are still in the viewport, that in a short window (1440 by 600 px, showing mode on) the brand, the "Showing" bar and Refresh are in the viewport while the menu scrolls, and that the rail's groups carry their names.
- **Screens baselines:** `shell.screens.ts` captures the whole rail, not only the `nav`. Every page's baseline changes, since `main` is 48 px narrower from 768 px and starts higher; they are regenerated in the container, in both modes, as the build's last step on a fresh rebase onto `main` (see the landing order above).

## Left to the builder

- How showing mode and Refresh are mounted for the two layouts (the mockup renders them in both places and hides one by breakpoint), as long as only one of each is visible and reachable by assistive technology at any width.
- The groups' markup and naming for assistive technology, as long as axe passes and each named section's name is announced with its links.
- The exact classes; the mockup (`claude/menu-mock`, `packages/web/src/layout/Menu.tsx` and `Shell.tsx`) is a reference for the look, not code to keep.

## My calls, for the owner to check

These were not asked one by one; each was shown in the mockup or the playback:

- In a short window the rail's menu scrolls between the brand and the foot, which stay in place.
- The 11 icons above.
- The "Imported <time>" line is not shown under 768 px.
- The brand is not a link, and replaces the dialog's visible title.
- The tab title and a favicon are in; every other rename is out.
- Section names in sentence case, 12 px, secondary ink; 24 px between sections, as `DESIGN.md`'s spacing says.
