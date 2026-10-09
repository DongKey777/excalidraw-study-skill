# Lint rules

`node <skill>/scripts/lint.mjs --rules` prints this catalog from the code. Errors fail the run (exit 2); warnings are decisions to make.

Text widths come from `build/render/measure.json` when it belongs to the current build (render.mjs measured them in the browser with Excalidraw's fonts), otherwise from an estimate (wide glyphs 1.0em, others 0.55em). The report says which.

| Rule | Severity | Catches | Usual fix |
|---|---|---|---|
| schema | error | not an Excalidraw v2 file, missing keys, duplicate ids, dangling frame ids | a kit bug or hand edit; rebuild |
| frames | error | frame count/position/size, single-slide files differ from the combined file, absolute paths | rebuild; never edit build output |
| spec | error | full slide without a takeaway | write the one sentence |
| text-overflow | error | a line wider than its text element | shorten, let it wrap (`card`, `note`, `wrap: true`), or widen |
| frame-escape | error | element outside its frame | move it in |
| header-zone | error | body content above y 236 | start the body at `s.body.y` |
| footer-gap | error | body content within 10px of the takeaway bar | use `s.body.h`, shrink the figure |
| text-overlap | error | two texts overlap | move or shorten one |
| card-spill | error | text runs outside the box it starts in | enlarge the box or shorten the text |
| shape-overlap | warn | boxes or chips partly overlap | space them; containment is fine |
| card-align | warn | side-by-side boxes of the same size start their titles at different heights (the kit already lines up centred boxes in a row; this catches rows that mix `valign: "top"` with centred boxes) | use the same `valign` across the row |
| tight-box | warn | text inside a box within 6px of its top or bottom edge | enlarge the box or cut a line |
| arrow-through-text | warn | an arrow crosses text | route with `via`, move the label |
| arrow-through-shape | warn | an arrow passes through a box or marker it does not start or end at | route with `via` or move the shape |
| empty-space | warn | a large empty region in the body | add the missing figure or rebalance |
| sparse-box | warn | a box far larger than its text (by area, or text using under 45% of a tall box's height) | size to content (`cardHeight`, `flow` does this) |
| orphan | warn | a wrapped paragraph ends with one short word alone | reword or change the width (the kit already balances lines it wraps) |
| min-font | warn | text below the role's minimum (body 15; labels and short one-line texts 14; source 12) | enlarge or cut text |
| type-scale | warn | more than six font sizes in a body | unify sizes |
| contrast | warn | text below 4.5:1 (3:1 from 24px), arrows below 3:1 | use tone title colours, darker strokes |
| accent-budget | warn | more than five accent hues (shades of one hue count once) | keep colour meanings; use neutrals |
| step-order | warn | steps go backwards inside a part, or a part is split | reorder |
| layout-repeat | warn | three or more consecutive slides share one composition | vary the figure where content differs |
| text-only | warn | more than 40% of slides have no figure | draw what the reader should see |
| density | warn | more than about 520 characters of body text, or three dense slides in a row | split, move detail to notes or evidence |
| banned | error | profile bans plus `writing.banned` | rewrite the sentence |
| dash | error | em/en dash in slide text | `·`, `~`, `→` or two sentences |
| emoji | error | pictographs | remove |
| code-ligature | warn | code set in Cascadia (fontFamily 3), which draws `>=`, `->`, `!=` as ligatures | use the default code font (fontFamily 8, Comic Shanns) |
| speech-level | error | polite endings in plain (~다) text | rewrite in ~다 |
| connective-comma | error | comma right after a connective ending (ko) | drop the comma or split; `writing.connectiveComma: "off"` to disable |
| title-period | error | title ends with a period | drop it |
| style | warn | translationese and AI-style signals from the profile and `writing.warn` | rewrite; `writing.allow` for accepted phrases |
| replace | warn | terms listed in `writing.replace` | use the preferred term |
| variants | warn | two spellings from `writing.variants` in one study | pick one |
| contrast-cadence | warn | "A가 아니라 B" more than once on a slide | keep one |
| repeated-text | warn | the same text (10 characters or more) three or more times on a slide; short labels repeated across parallel cards are structure and not counted | say it once |
| numbers | warn | more quantities than `writing.maxNumbersPerSlide`. Identifiers are not counted: case and slide numbers, PR and issue numbers, migration versions, section marks, commit hashes, dates, clock times, product versions and letter-led codes (EC2, t4g). Add study-specific ones with `writing.identifiers` | keep the ones that help |
| timezone | warn | clock time without a zone (when `requireTimezone`) | add KST/UTC |
| glossary-order | error | a term used in prose before the slide that explains it (code excerpts are skipped) | move the explanation earlier or the use later |
| docs | warn | banned words or dashes in the study's markdown files | fix the docs too |
| unfilled | warn | `brief.md` or `plan.md` still carries the template marker line | write it and delete the marker (`review.mjs` reports the same for `README.md`) |
| takeaway-length | warn | the takeaway wraps to a second line | one sentence that fits one line |
| claims | error | cited claim missing or not verified | add or verify it in `evidence/claims.md` |
| unsourced-numbers | warn | three or more measured-looking numbers with no source or claims | cite or remove |

## Ignoring a finding

Ignoring is for findings that are wrong for this case, not for findings that are inconvenient.

- **Element**: `lint: { ignore: ["rule-id"], reason: "why" }` on that primitive. You may add these when the reason is concrete ("timeline labels are the content").
- **Slide**: `lint: { ignore: [...], reason }` in the slide spec. Same bar.
- **Study**: `lint.ignore` in `study.config.mjs` (`{ "rule-id": "who decided and why" }`) or `lint.off`. Only with the user's agreement, and name them in the reason.

Ignored findings are listed in `build/lint.json` with their reasons and counted in the report. Never ignore a finding just to pass.
