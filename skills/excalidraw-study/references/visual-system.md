# Visual system

The study is read on a screen, often scaled to half size or less, in "read" mode: the reader wants to understand, not to be persuaded. Structure for comprehension first.

## Canvas and chrome

- Frame 1600x900. Frames sit in a grid of 4 columns with 180px gaps, in slide order.
- **Header** (y 45–236): badge (`NN part · topic`), step chips (top right), series line, title (44px, shrinks to 30), subtitle (21px, shrinks to 16).
- **Body**: `s.body` = x 70, y 236, width 1460, down to 16px above the takeaway bar.
- **Takeaway bar** (bottom at y 864): the slide's one sentence (`takeaway`) and, on fix slides, what remains (`left`).
- **Series colours**: a diagram with parallel series (branches, processes, versions) may give each series its own colour from the palette (blue, purple, teal, orange). Keep tones for meaning (problem, fix, concept, note), use the same series colour on every slide, and label the series once (a chip or legend). Do not reuse a tone colour for a series when that tone already means something on the slide.
- **Source note**: a one-line footnote under the bar (13px, 12px if needed, right-aligned). A source too long for one line goes to the header above the body instead; shorten it rather than let that happen.
- `chrome: "cover"` gives a title slide with an optional contents list (`items`) and `meta` line.

Lint enforces the zones: body content may not enter the header (`header-zone`) or come within 10px of the bar (`footer-gap`).

## Type

| Role | Size | Notes |
|---|---|---|
| title | 44 → 30 | one line |
| subtitle | 21 → 16 | one line; says what the reader will see, not a restatement of the title |
| card title | 22 | |
| body | 18 | minimum 15 |
| labels, chips | 17–18 | minimum 14 |
| code | 18 | monospace only for code and identifiers |
| source | 13 | minimum 12 |

At most six sizes in a body (`type-scale`). Adjacent roles should differ clearly (about 1.2x or more).

## Colour means something

Tones (`TONES` in the kit) carry fixed meanings across the study:

| Tone | Meaning |
|---|---|
| problem | what went wrong, the cost |
| fix | what was changed, the result |
| note | caution, a condition, a limit |
| info | a fact, a measurement |
| concept | a definition, how something works |
| memory | memory, state, internals |
| warn | a risk, an open question |
| plain / muted | neutral content |

- Decide the mapping on the first content slide and keep it. Never pick a tone for variety.
- At most five accent hues per slide, shades of one hue counting once (`accent-budget`).
- Every colour distinction also needs a label, position or shape; colour alone is not enough.
- Accent text on a soft fill must reach 4.5:1 (`contrast`); the default palette uses darker text shades for this. Arrows need 3:1 against the background; the light line colour is for rules and borders, not arrows.

## Choose the figure from the relationship

Decide what relationship the slide teaches, then pick the figure. This is the most important visual decision.

| Relationship | Figure | Kit |
|---|---|---|
| steps in order, a request path | flow of cards with arrows | `s.flow` |
| structure, containment, layers | nested or stacked shapes: pages inside a buffer, leaves under a root | `s.rect`, `s.page`, `s.rows`/`s.cols` |
| before / after, two options | two columns with the difference highlighted | `s.cols` + `s.card` (tones problem/fix) |
| change over time | timeline | `s.timeline` |
| quantity comparison | bars on one scale | `s.bars` |
| many attributes across items | table | `s.table` |
| exact syntax, a plan, a log | code panel with the key lines highlighted | `s.code(…, { highlight: [2] })` |
| state machine, visibility rules | shapes per state with labelled transitions | `s.rect`/`s.ellipse` + `s.connect({ label })` |
| a term explained | one concept figure + one plain sentence | any of the above |

Guidance:

- **Show, then say.** A figure that makes the idea visible beats a paragraph in a box. If the only figure is text in boxes, ask what the reader should *see* (an order, a pointer, a boundary, a jump) and draw that.
- **Arrows only for movement or causality.** Do not connect every box. Too many arrows read as noise; prefer position and alignment to show grouping.
- **Size boxes to their content.** A tall box with two lines in it is empty space with a border (`sparse-box`).
- **Fill the body deliberately.** Large empty regions (`empty-space`) mean the slide lacks its figure or the layout is off balance. Empty space around a central figure is fine; an empty half is not.
- **Vary layouts.** Three or more slides in a row with the same arrangement (`layout-repeat`) read as a template being filled. Consistency belongs to the chrome, spacing and colour meaning, not to identical compositions.
- **Keep code real.** Excerpts come from real files or real command output; mark omissions with `…`. Never draw a fake terminal or tool window.

## Craft floor

Things no detector fully catches. Check them in review.

- One dominant element per slide; everything else is secondary or muted.
- Alignment: shared left edges and baselines between neighbouring elements.
- Proximity: space between groups larger than space inside a group.
- Labels next to what they label; captions under figures, not floating.
- No decorative icons, emoji or "01/02" markers unless the order itself is the content (`s.marker` is for real sequences).
- No coloured stripe on the left of a card as a callout.
- No subtitle that repeats the title, no card that repeats the takeaway.
- Numbers and units stay together; the same quantity has the same unit across slides.

## Anti-patterns seen in generated slides

- Every slide is three equal cards.
- Everything boxed, boxes inside boxes without real containment.
- A random tone per card.
- Everything centred, or centred and left-aligned text mixed in one group.
- A diagram whose arrows cross text (`arrow-through-text`).
- Chips overlapping each other (`shape-overlap`).
- Invented precision: exact numbers without a source.
- The same "A가 아니라 B" sentence shape on every slide (`contrast-cadence`).
