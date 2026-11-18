---
version: alpha
name: edward
description: >-
  A night-glass dashboard for reading a coding workflow's runs, findings and spend. Tinted glass panels, with a sheen and a bright edge, float over a
  vivid night gradient lit by soft colour orbs; type is white, numbers line up, and colour carries data or state, never
  decoration. Light mode is the same glass in daylight: pale colour blobs behind white glass panels, dark ink.
colors:
  primary: "#ffffff"
  primary-foreground: "#2a1a6e"
  background: "#1a1240"
  foreground: "#ffffff"
  panel: "rgb(28 18 72 / 0.62)"
  panel-edge: "rgb(255 255 255 / 0.3)"
  muted-foreground: "#d9d3ff"
  border: "rgb(255 255 255 / 0.14)"
  input: "rgb(255 255 255 / 0.35)"
  ring: "#7ef9ff"
  destructive: "#ff6b81"
  warning-edge: "#ec835a"
  warning-ink: "#ffc8ab"
  success-edge: "#34d399"
  notice: "rgb(250 178 25 / 0.14)"
  notice-edge: "#fab219"
  notice-ink: "#ffe2a8"
  orb-pink: "#ff3cac"
  orb-blue: "#2b86c5"
  orb-violet: "#784ba0"
  orb-teal: "#00d2b8"
  mark-pink: "#ff3cac"
  mark-teal: "#00d2b8"
  light-background: "#eef1fb"
  light-foreground: "#10162f"
  light-panel: "rgb(255 255 255 / 0.62)"
  light-panel-edge: "rgb(255 255 255 / 0.85)"
  light-muted-foreground: "#3d4664"
  light-border: "rgb(16 22 47 / 0.1)"
  light-primary: "#10162f"
  light-primary-foreground: "#ffffff"
  light-input: "rgb(16 22 47 / 0.2)"
  light-ring: "#3f5cf0"
  light-destructive: "#d03b3b"
  light-warning-ink: "#a8461c"
  light-notice: "#fff4e0"
  light-notice-edge: "#d97706"
  light-notice-ink: "#5a2d00"
  light-success-edge: "#15803d"
typography:
  family: "Outfit Variable, ui-sans-serif, system-ui, sans-serif"
  numbers: tabular-nums
  page-title: { size: 28px, weight: 700, tracking: -0.03em, leading: 1.15 }
  section-title: { size: 16px, weight: 600, tracking: -0.01em }
  body: { size: 14px, weight: 400, leading: 1.5 }
  table: { size: 14px, weight: 400, head-weight: 600 }
  small: { size: 12px, weight: 500 }
  wordmark: { size: 20px, weight: 300, ward-weight: 700, tracking: -0.025em }
rounded:
  base: 0.875rem
  panel: 1.25rem
  control: 9999px
  swatch: 3px
  # tokens: --radius (base), --radius-panel, --radius-control, --radius-swatch
spacing:
  scale: tailwind default (4px steps)
  inside-group: 12px
  between-groups: 24px
components:
  panel: tinted glass with a white sheen, 1px bright edge, inner top highlight, soft drop shadow, panel radius
  button: pill; the pressed option is solid primary, the others clear glass with an edge
  select: pill, clear glass, a drawn chevron inset like the text
  input: pill, as buttons and selects
  table: rows on the panel, hairline row borders, header row slightly lighter, row hover lightens
  menu: a glass rail, 224px and window-tall; named sections of icon and label entries, the current page a lighter pill with full-weight text; the brand on top, and at its foot hosted mode's account switcher, showing mode (a read-only bar while viewing another account), Refresh (local mode only), hosted mode's account links and the import time
  chart: drawn on the panel, recessive grid, the categorical palette below
  heatmap-cell: one-hue blue ramp, zero a faint glass cell with muted ink
  share-bar: blue fill on the ramp's track
  reporter-mark: muted small text with a dotted underline, no border or fill
  notice: amber glass bar with an amber edge
---

# edward

## Overview

The dashboard answers one person's questions about their own coding workflow: what ran, what the reviews found, what it cost, what broke a rule. It is a playground and a portfolio piece, so it has a look of its own: **night glass**. A deep violet-to-navy gradient fills the page, lit from behind by four large, soft colour orbs. Everything the reader works with sits on glass panels that tint what is behind them. The look is bold in one place, the backdrop, and quiet everywhere the data is: on a panel, type is plain white, numbers line up, and colour appears only where it encodes a series or a state.

Dark is the look. Light mode is its daylight pair: the same panels, radii, type and rules, with pale blobs behind white glass and dark ink. The app follows the system's setting.

## Colors

**Backdrop.** Dark: a 135° gradient from `#1a1240` through `#2a1060` to `#10204f`, under four radial orbs (pink `#ff3cac` top left, blue `#2b86c5` top right, violet `#784ba0` bottom right, teal `#00d2b8` bottom left), each fading to nothing at about 60% of its radius, the teal orb held at 30% opacity, the others at 55%, so no orb dominates a panel. Light: `#eef1fb` under cyan `#a5f3fc`, lavender `#c4b5fd`, rose `#fecdd3` and mint `#bbf7d0` blobs. The backdrop is fixed; it does not scroll with the page.

**Panels.** Dark panels are `rgb(28 18 72 / 0.62)` with a white sheen from 10% to 2% top-left to bottom-right; light panels are white at 62%. The tint is what keeps text contrast independent of the orb behind it. At the worst place in dark (the teal orb's centre), warning ink measures 6.49:1 on a panel, 4.90:1 in a table's header band and 4.63:1 on a hovered item; secondary ink 5.11:1 in the band and 4.83:1 on a hovered item; the notice bar's ink 4.55:1; primary ink 6.67:1 on the backdrop itself. Every ink passes 4.5:1 on every panel surface wherever the panel sits; `contrast.test.ts` computes it from the tokens.

**Ink.** Primary text white / `#10162f`; secondary `#d9d3ff` / `#3d4664`. There are only these two text inks plus the status inks; a value, label or legend never takes a series colour. Text directly on the backdrop is primary ink only; secondary and status inks appear only on a panel, a table container, a dialog, a popover or a notice bar.

**Primary and focus.** The primary action is a white pill with violet ink (`#2a1a6e`) in dark mode and an ink pill with white text in light mode. The focus ring is cyan `#7ef9ff` / indigo `#3f5cf0`, 2px, offset 2px.

**Status.** Warning edges use the serious orange `#ec835a` in both modes; warning text is `#ffc8ab` dark / `#a8461c` light. In the feed, each item's status is a swatch beside its word: a new warning's in the warning orange, a finished run's in green, `#34d399` dark / `#15803d` light. The import notice and showing-mode bar are amber glass: `rgb(250 178 25 / 0.14)` with an `#fab219` edge and `#ffe2a8` ink in dark; `#fff4e0`, `#d97706` and `#5a2d00` in light. Destructive is `#ff6b81` / `#d03b3b`.

The mark, and only the mark, uses two of the backdrop's orb colours (pink and teal), the same in both modes.

## Typography

One family, **Outfit** (open licence, variable weight), bundled with the app so it works offline. It is geometric and rounded like the glass, and it has tabular figures, which every number column needs (Sora, rendered in the direction step, lacks them). Numbers are always set with `tabular-nums`.

| Role | Size | Weight | Tracking |
|---|---|---|---|
| Page title | 28px | 700 | -0.03em |
| Section title | 16px | 600 | -0.01em |
| Body, table cells | 14px | 400 | 0 |
| Table header | 14px | 600 | 0 |
| Small, captions | 12px | 500 | 0 |
| Wordmark | 20px | 300, "ward" in 700 | tight |

The page and section title sizes are the tokens `text-page-title` and `text-section-title` (size, line height, tracking and weight in one utility).

Three levels of emphasis at most on a screen: the page title, section titles, and body. Weight and size carry them; colour does not.

## Layout

A glass menu rail on the left, as tall as the window and static while the page scrolls: edward's mark and wordmark, the pages in named sections, and at its foot, in hosted mode, the account switcher, then showing mode (a read-only bar naming the viewed account's projects while viewing one), Refresh (local mode only), in hosted mode the account links (the signed-in login, linking to the Account page, and Admin for the admin), and the time of the last good import; in a short window only its menu scrolls. From 768px there is no header row: the import banner shows above the page only when it has something to say. Under 768px the rail is hidden and a top row holds a Menu button, which opens the same sections in a dialog (with the account links at its foot in hosted mode), the account switcher in hosted mode, showing mode and Refresh (local mode only). Content is left-aligned and uses the full width it is given. Groups are separated by 24px, items inside a group by 12px or less. Panels hold related content; the page title, filters and notes sit directly on the backdrop.

## Elevation & Depth

Depth comes from glass, not from stacked shadows. One level: a panel has a 1px edge (white 30% dark / 85% light), an inner 1px top highlight (white 40% / 90%), and one soft drop shadow (`0 20px 50px rgb(10 5 40 / 0.45)` dark, `0 10px 30px rgb(30 40 90 / 0.12)` light), over its tint and sheen. A panel has no backdrop blur or saturation, since a filter on a panel is recomputed on every scroll frame over the fixed backdrop, and the backdrop is already soft. Popovers and chart tooltips are solid (`--popover`, the panel's solid colour) with the panel's edge, and shadcn's small tooltips invert (ink background, page-colour text), so they read over any panel. Never a panel inside a panel.

With `prefers-reduced-transparency: reduce`, panels become solid (`#2a1d5e` / `#f7f8fd`); under `forced-colors`, the system colours take over and the edge stays.

## Shapes

Panels and notice bars use a 1.25rem radius; buttons, selects, text fields and pressed options are pills; table rows are square inside their panel; legend and table swatches are 3px-rounded squares. Nothing else is rounded.

## Components

- **Panel:** the glass recipe above. Charts, tables and the workflow diagram sit on panels; prose notes do not.
- **Button and option switch:** pills. In a switch, the pressed option is solid primary and the others are clear glass with an edge; a disabled option is 50% opacity with its tooltip still reachable.
- **Select:** a clear glass pill with a drawn chevron in secondary ink, inset from the right as far as the text is from the left; its open list uses the system's popup.
- **Text field:** a pill, as buttons and selects are.
- **Table:** header row a slightly lighter glass band, header text 600; hairline row borders; row hover lightens the row by one glass step. Numeric columns right-aligned with tabular figures; the unit goes in the header; the one cell that carries its own unit is a session's length ("45 min", "7 h 46", "3 d 11 h"). A table that scrolls sideways fades at the edge where columns are hidden.
- **Menu rail:** glass, 224px; section names in the small role in secondary ink, 24px between sections; an entry is a 16px icon and its label, the current page a lighter pill with 600 weight, the rest 400 with hover; an icon never carries state; the brand on top, and at the foot, above a hairline, hosted mode's account switcher, showing mode (read-only while viewing another account), Refresh (local mode only), hosted mode's account links and the import time.
- **Heatmap cell:** the ramp under Chart colours, its number written in it.
- **Share bar:** the ramp's fourth step on its first step, the percent written beside it.
- **Reporter mark:** a figure from the reporter's all-time totals is followed by muted 12px text with a dotted underline that opens its explanation; it has no border or fill, so it never reads as a chip.
- **Notice bars:** amber glass, as under Colors.

## Do's and Don'ts

Do:
- Let the backdrop be the one bold element; keep panels calm.
- Put every data region on a panel, and every number in tabular figures.
- Use tinted, see-through panels and the coloured glow of the orbs: they are this project's look, not a template's.
- Show, don't tell. Text that explains how to read a screen is allowed only after checking that it is necessary, not redundant with what is drawn, and not covering for a design gap.

Don't:
- Glow text, gradient-fill text or add neon edges: the glass is the effect, and more of it fights the data.
- Use a series colour for text, or a status colour for a series.
- Put a panel inside a panel, or a card around a single paragraph.
- Animate the backdrop.

## Data display

- **Tables:** one value per cell. A breakdown is labelled pairs, a small table or a bar, never a "·"-joined sentence. The unit sits in the header once; cells hold plain numbers with a fixed number of decimals per column (cost 2, shares whole percent, durations whole minutes).
- **Numbers:** through the shared formatters on `Intl.NumberFormat`; compact counts as "281K", "1.3M".
- **Dates:** one format per precision on a page: "Nov 8" for a day, "Nov 8, 14:05" for a time.
- **Zero and unknown:** zero is shown, in secondary ink, never styled as notable; unknown is a muted "–" with an accessible label; a comparison with no earlier data says so.

## States

- **Loading:** the region's panel with one muted line saying what is loading.
- **Empty:** says what the region shows and how it fills; "nothing matches these filters" is a different message and offers to clear them.
- **Error:** says what failed and what to do next, in the panel, in primary ink with a warning edge.

## Motion

Motion explains a change and nothing else: a detail row opening, data refreshing in place. Transitions animate `opacity` and `transform` only, never `all`, finish within 200ms (exits faster than entrances), and are removed under `prefers-reduced-motion`. Charts do not animate. Hover changes are instant.

## Dark mode

Every colour role has a dark and a light value (front matter, Colors), except the mark's two colours, one value for both modes. Dark is the look; the app sets `.dark` on the root from the system's `prefers-color-scheme` and follows its changes.

## Chart colours

The categorical palette is the dataviz reference palette in its fixed order, validated on both glass surfaces (dark `#2a1d5e`, light `#f3f4fb`):

| Slot | Light | Dark |
|---|---|---|
| 1 blue | `#2a78d6` | `#3987e5` |
| 2 orange | `#eb6834` | `#d95926` |
| 3 aqua | `#1baf7a` | `#199e70` |
| 4 yellow | `#eda100` | `#c98500` |
| 5 magenta | `#e87ba4` | `#d55181` |
| 6 green | `#008300` | `#0ca30c` |
| 7 violet | `#6250d6` | `#9085e9` |
| 8 red | `#e34948` | `#e66767` |

Dark passes every check (worst adjacent CVD ΔE 8.4, normal 19.3, all over 3:1). Light passes, with four slots under 3:1 on the light surface, so every chart keeps its table view. "The rest" (Unattributed) is a neutral grey outside the palette: `#b5b4ad` / `#8b8794`. Chart chrome: ink `#3d4664` / `#d9d3ff`, gridlines `rgb(16 22 47 / 0.08)` / `rgb(255 255 255 / 0.12)`, baseline at 25% / 35%.

The sequential ramp (heatmaps, share bars) is the reference blue. Light, near zero to high: `#cde2fb`, `#9ec5f4`, `#6da7ec`, `#2a78d6` (black ink), `#184f95` (white ink). Dark, near zero to high, brightening: `#184f95`, `#256abf` (white ink), `#5598e7`, `#86b6ef`, `#cde2fb` (ink `#10162f`). Zero is a faint glass cell, white at 6% (dark) or 55% (light), with secondary ink.

References: none of the kit library's entries was kept. The look comes from the owner's own brief (glassmorphism, with liquid glass as its light pair), rendered on the Spend page and picked in the direction step on 2026-11-16. The library entries rendered and set aside along the way were fetched from VoltAgent/awesome-design-md at commit `e06a96660396d741d0c106c8972172254dafbdc2`.
