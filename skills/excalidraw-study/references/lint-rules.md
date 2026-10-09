# Lint rules

`node <skill>/scripts/lint.mjs --rules` prints this catalog from the code. Errors fail the run (exit 2); warnings are decisions to make.

Scope says where a rule looks and so where an ignore for it can go: **element** rules report one element (an element or slide ignore works), **slide** rules judge a whole slide (only a slide ignore works), **study** rules judge the study (only `study.config.mjs` works).

Text widths come from `build/render/measure.json` when it belongs to the current build (render.mjs measured them in the browser with Excalidraw's fonts), otherwise from an estimate (wide glyphs 1.0em, others 0.55em). The report says which.

| Rule | Severity | Scope | Catches | Usual fix |
|---|---|---|---|---|
| schema | error | study | not an Excalidraw v2 file, missing keys, duplicate ids, dangling frame ids | a kit bug or hand edit; rebuild |
| frames | error | slide | frame count/position/size, single-slide files differ from the combined file, absolute paths | rebuild; never edit build output |
| spec | error | slide | full slide without a takeaway | write the one sentence |
| text-overflow | error | element | a line wider than its text element | shorten, let it wrap (`card`, `note`, `wrap: true`), or widen |
| frame-escape | error | element | element outside its frame | move it in |
| header-zone | error | element | body content above y 236 | start the body at `s.body.y` |
| footer-gap | error | element | body content within 10px of the takeaway bar | use `s.body.h`, shrink the figure |
| text-overlap | error | element | two texts overlap | move or shorten one |
| card-spill | error | element | text runs outside the box it starts in | enlarge the box or shorten the text |
| shape-overlap | warn | element | boxes or chips partly overlap | space them; containment is fine |
| card-align | warn | element | side-by-side boxes of the same size start their titles at different heights (the kit already lines up centred boxes in a row; this catches rows that mix `valign: "top"` with centred boxes) | use the same `valign` across the row |
| tight-box | warn | element | text inside a box within 6px of its top or bottom edge | enlarge the box or cut a line |
| card-size | warn | element | a card in a row was shrunk to fit and its body text is smaller than its neighbours' | shorten the text or give the row more height |
| arrow-through-text | warn | element | an arrow or any drawn line (`s.line`, axes, lifelines, dividers) crosses text; table rules are not counted | route with `via`, move the label |
| arrow-through-shape | warn | element | an arrow or a line that connects two shapes passes through a box or marker it does not start or end at | route with `via` or move the shape |
| empty-space | warn | slide | a large empty region in the body | add the missing figure or rebalance |
| sparse-box | warn | element | a box far larger than its text (by area, or text using under 45% of a tall box's height) | size to content (`cardHeight`, `flow` does this) |
| orphan | warn | element | a wrapped paragraph ends with one short word alone | reword or change the width (the kit already balances lines it wraps) |
| min-font | warn | element | text below the role's minimum (body 15; labels and short one-line texts 14; source 12) | enlarge or cut text |
| type-scale | warn | slide | more than six font sizes in a body | unify sizes |
| contrast | warn | element | text below 4.5:1 (3:1 from 24px), arrows below 3:1 | use tone title colours, darker strokes |
| accent-budget | warn | slide | more than five accent hues (shades of one hue count once) | keep colour meanings; use neutrals |
| step-order | warn | slide | steps go backwards inside a part, or a part is split | reorder |
| layout-repeat | warn | slide | three or more consecutive slides share one composition | vary the figure where content differs |
| text-only | warn | study | more than 40% of slides have no figure | draw what the reader should see |
| density | warn | slide | more than about 520 characters of body text, or three dense slides in a row | split, move detail to notes or evidence |
| banned | error | element | profile bans plus `writing.banned` | rewrite the sentence |
| dash | error | element | em/en dash in slide text | `·`, `~`, `→` or two sentences |
| emoji | error | element | pictographs | remove |
| code-ligature | warn | element | code set in Cascadia (fontFamily 3), which draws `>=`, `->`, `!=` as ligatures | use the default code font (fontFamily 8, Comic Shanns) |
| speech-level | error | element | polite endings in plain (~다) text | rewrite in ~다 |
| connective-comma | error | element | comma right after a connective ending (ko) | drop the comma or split; `writing.connectiveComma: "off"` to disable |
| title-period | error | element | title ends with a period | drop it |
| style | warn | element | translationese and AI-style signals from the profile and `writing.warn` | rewrite; `writing.allow` for accepted phrases |
| replace | warn | element | terms listed in `writing.replace` | use the preferred term |
| variants | warn | study | two spellings from `writing.variants` in one study | pick one |
| contrast-cadence | warn | slide | "A가 아니라 B" more than once on a slide | keep one |
| repeated-text | warn | slide | the same text (10 characters or more) three or more times on a slide; short labels repeated across parallel cards are structure and not counted | say it once |
| numbers | warn | slide | more quantities than `writing.maxNumbersPerSlide`. Identifiers are not counted: case and slide numbers, PR and issue numbers, migration versions, section marks, commit hashes, dates, clock times, product versions and letter-led codes (EC2, t4g). Add study-specific ones with `writing.identifiers` (for example HTTP status codes: `identifiers: [/\b[1-5]\d\d\b/]`) | keep the ones that help |
| timezone | warn | element | clock time without a zone (when `requireTimezone`) | add KST/UTC |
| glossary-order | error | element | a term used in prose before the slide that explains it (see matching below) | move the explanation earlier or the use later |
| docs | warn | study | banned words or dashes in the study's markdown files | fix the docs too |
| unfilled | warn | study | `brief.md` or `plan.md` still carries the template marker line | write it and delete the marker (`review.mjs` reports the same for `README.md`) |
| takeaway-length | warn | element | the takeaway wraps to a second line | one sentence that fits one line |
| claims | error | slide | cited claim missing or not verified | add or verify it in `evidence/claims.md` |
| unsourced-numbers | warn | slide | three or more measured-looking numbers with no source or claims | cite or remove |

## Glossary matching

`glossary` maps a term to the id of the slide that explains it. Matching is case-sensitive, so "stale" and "Stale" are two entries. A term in Latin letters matches as a whole word ("index" in "index가" but not in "indexes"); any other term matches wherever it appears. Titles, subtitles, the takeaway, body text and `s.chip` labels are checked. The cover, code, monospace text, step chips, `s.pill` and marker labels, chart values and sources are not, so a term inside `s.code` or a monospace label does not count as a use.

## Ignoring a finding

Ignoring is for findings that are wrong for this case, not for findings that are inconvenient.

- **Element**: `lint: { ignore: ["rule-id"], reason: "why" }` on that primitive. You may add these when the reason is concrete ("timeline labels are the content"). Only element-scope rules can be ignored here.
- **Slide**: `lint: { ignore: [...], reason }` in the slide spec. Same bar. With several rules, give each its reason: `reason: { numbers: "…", "repeated-text": "…" }`.
- **Study**: `lint.ignore` in `study.config.mjs` (`{ "rule-id": "who decided and why" }`) or `lint.off`. Only with the user's agreement, and name them in the reason.

An element ignore covers every finding of that rule on that element. For the arrow rules the element is the arrow or line, so ignoring `arrow-through-text` on an axis for its tick labels also hides a caption the axis crosses. Prefer moving the one label; when you do ignore, the report notes element ignores that hid more than one finding, and ignores that cannot work where they are written (a slide rule on an element, an arrow rule on the text it crosses, an unknown rule id).

Ignored findings are listed in `build/lint.json` with their reasons and counted in the report. Never ignore a finding just to pass.
