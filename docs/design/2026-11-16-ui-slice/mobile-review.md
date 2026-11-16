# Mobile: parked for its own review

The UI slice makes every screen fit and pass the checks at 375 px, with the menu behind a Menu button. It does not design the screens for a phone. The owner reviews mobile specifically later; issues seen at 375 px are parked here until then, not fixed in the slice.

## Parked

- A table that scrolls sideways at 375 px shows no cue that more columns exist (Sessions, Context, Spend, Weeks, Models, Steps, Skills, Runs). The kit's "every width" rule asks for a visible cue or stacked rows.
- Wide tables keep their column order at 375 px, so the columns that answer the screen can start off-screen (Sessions' Length and Est. cost, Spend's totals).
- The menu opens as a dialog at the top left; a sideways-scrolling pill row and a "Page" select were named as alternatives and not tried.
- Charts at 375 px are the desktop charts, narrower: legends wrap and x-axis labels thin out.
