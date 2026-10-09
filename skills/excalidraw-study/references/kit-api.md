# Kit API

A slide module is an ES module in `slides/` (files are read in name order). It exports a function that receives the kit and returns one slide or an array. Files whose names start with `_` are not slides; put shared drawing helpers there and import them (`import { branch } from "./_git.mjs"`).

```js
// slides/20-case2.mjs
export default ({ slide }) => [
  slide({
    id: "c2-btree",            // required, kebab-case, unique, never contains the slide number
    part: "c2",                // key of `parts` in study.config.mjs
    step: "원리",              // one of the configured steps
    kind: "structure",         // free label for your plan (flow, compare, table, code, …)
    title: "B-tree 리프는 키 순서로 정렬되고 옆 리프와 이어진다",
    subtitle: "리프를 옆으로 따라가며 범위를 읽는다",
    takeaway: "범위 조건은 리프를 순서대로 읽는다.",
    left: "",                  // fix slides: what remains open
    source: "근거 §2",         // short pointer into evidence/sources.md, shown as a footnote under the takeaway bar
    claims: ["C4", "C5"],      // ids in evidence/claims.md
    lint: { ignore: ["numbers"], reason: "timeline of the incident; numbers are the content" },
  }, (s) => {
    const [left, right] = s.cols(s.body, [3, 2], 40);
    s.card(left, { title: "…", body: "…", tone: "concept" });
    s.code("EXPLAIN …", right.x, right.y, right.w, 220, { highlight: [1] });
  }),
];
```

`{{#slide-id}}` anywhere in text becomes that slide's number.

A cover slide (`chrome: "cover"`) takes `items` for a contents list; an item is a string or `{ text, ref: "slide-id" }`, and with `ref` the number shown is that slide's number. `meta` adds a line at the bottom.

Code uses Excalidraw's Comic Shanns font (`fontFamily` 8) by default. Cascadia (3) draws `>=`, `->` and `!=` as ligatures, which readers copy wrongly; lint warns (`code-ligature`).

## Coordinates

Everything inside `draw` is frame-local: (0,0) is the frame's top-left, the frame is 1600x900. `s.body` is the content area `{ x, y, w, h }` between the header and the takeaway bar.

## Layout helpers

| Call | Returns |
|---|---|
| `s.cols(rect, n \| [weights], gap = 24)` | rects side by side |
| `s.rows(rect, n \| [weights], gap = 24)` | rects stacked |
| `s.inset(rect, dx, dy = dx)` | a smaller rect |
| `s.cardHeight(w, { title, body, … })` | the height a card needs at width `w` |
| `s.group(fn)` | elements drawn in `fn` move together in Excalidraw |

`rect(x, y, w, h)`, `inset`, `split(rect, parts, { dir, gap })` are also exported for use outside `draw`.

## Components

| Call | Draws |
|---|---|
| `s.card(rect, { title, body, tone, align, valign, titleSize, bodySize, min })` | titled box; wraps text at spaces and shrinks the body (down to `min`, default 15) until it fits. Content is centred; centred boxes with a title and a body, of the same size in one row, start where the fullest one starts, so their titles line up |
| `s.flow(rect, items, { dir = "h", gap = 56, valign, height, tone })` | cards joined by arrows. `items`: strings or `{ title, body, tone, weight, via }` (`via` labels the arrow into that card). Row cards take the height their content needs. |
| `s.table(rect, rows, { weights, size = 17, header = true, align: [...], fill })` | table; `rows[0]` is the header. Cells: string or `{ t, color, size, family, fill, align }`. Rows take their natural height; `fill: true` stretches them. |
| `s.timeline(rect, events, { cardWidth })` | axis with dots; events `{ at, title, body, tone, pos }` (`pos` 0..1 overrides even spacing) |
| `s.bars(rect, data, { max, format, tone, labelWidth })` | horizontal bars; data `{ label, value, display, tone }` |
| `s.code(text, x, y, w, h, { highlight: [lineIndex], size, valign })` | dark code panel; highlighted lines get a band |
| `s.connect(a, b, { label, dir, color, style, start, end })` | arrow between the facing edges of two rects |
| `s.note(text, x, y, w, { size, color })` | muted explanatory text, wrapped |
| `s.marker(n, x, y, { color, d })` | numbered circle, for real sequences only |
| `s.graph(nodes, edges, { shape, d, w, h, tone, route, size })` | nodes and edges: commit graphs, trees, state machines. Node `{ id, x, y, label, sub, shape: "circle" \| "box", d \| w, h, tone, strokeStyle }` with `x, y` as its centre; edge `{ from, to, label, route: "straight" \| "hv" \| "vh", style, color, arrow }` (`hv` goes across then up or down). Edges start and end on the node outline. |

## Primitives

Compatible with earlier generators:

| Call | Notes |
|---|---|
| `s.rect(x, y, w, h, { fill, stroke, strokeWidth, strokeStyle, radius, opacity })` | |
| `s.ellipse(x, y, w, h, { … })` | |
| `s.text(value, x, y, width, { size = 24, color, align, family, lineHeight = 1.25, wrap })` | `wrap: true` wraps at spaces to `width` |
| `s.arrow(x1, y1, x2, y2, { color, width, style, start, end, via: [[x, y], …] })` | `via` adds bend points |
| `s.line(x1, y1, x2, y2, { color, width })` | |
| `s.box(x, y, w, h, title, body, { tone, align, valign, titleSize, bodySize, pad, family })` | titled box at exact coordinates |
| `s.pill(label, x, y, w, { fill, color, size, height })` | |
| `s.chip(label, x, y, { anchor: "center" \| "right", size })` | pill sized to its label; returns its width |
| `s.page(x, y, label, { width = 92, height = 60 })` | small labelled square (a page, a block, a slot) |
| `s.label(value, x, y, width, { … })` | muted 18px text |

Every primitive accepts `role` (used by lint) and `lint: { ignore: ["rule-id"], reason: "…" }` for an element-level exception.

`s.C` is the colour palette, `s.theme.tones` the tones, `s.stepTheme` the current step's colours.

## Return values

Use them to place the next element instead of guessing coordinates.

| Call | Returns |
|---|---|
| `s.card`, `s.box`, `s.code`, `s.table`, `s.page`, `s.pill`, `s.marker` | the drawn rect `{ x, y, w, h }` (for `table`, the height the rows took) |
| `s.flow` | the card rects |
| `s.graph` | `{ nodes: { id: { x, y, w, h, cx, cy } }, edges: [id] }` |
| `s.text`, `s.label`, `s.note` | `{ id, x, y, w, h, text }` with the wrapped text and its height |
| `s.chip` | its width |
| `s.rect`, `s.ellipse`, `s.arrow`, `s.line`, `s.connect` | the element id |
| `s.timeline`, `s.bars` | nothing |

## Text widths

The kit wraps text before anything is rendered, so it estimates widths. Until the first full render it uses generous factors (wide glyphs 1.0em, others 0.55em). After a full `check.mjs`, the widths Excalidraw measured are fitted into `build/metrics.json` and `check.mjs` builds and renders once more with them, so text uses its boxes' width. The factors never go below 0.88em and 0.5em, which leaves a margin for other systems' fonts. Set `metrics: { calibrate: false }` in `study.config.mjs` to keep the generous defaults, or fixed values such as `metrics: { wide: 0.95 }`.

## study.config.mjs

```js
export default {
  name: "postgres-basics",            // output file name: postgres-basics.excalidraw
  title: "…",
  series: "…",                        // small line in every header
  lang: "ko",                         // ko | en: labels and writing profile
  steps: "case-first-ko",             // case-first-ko | concept-first-ko | case-first-en | none | [{ name, color, soft }]
  parts: { c1: { label: "사건 1", topic: "연결과 타임아웃" } },
  glossary: { "BUFFERS": "c2-buffers" },   // term -> slide id that explains it
  writing: {
    banned: ["판본", { re: "(?<!인)덱", why: "'자료'라고 쓴다" }],
    replace: { "표를 조회": "테이블을 조회" },
    variants: [["리팩토링", "리팩터링"]],
    allow: [],                         // phrases exempt from style warnings
    connectiveComma: "error",          // or "off"
    maxNumbersPerSlide: 12,          // quantities per slide; identifiers are not counted
    identifiers: [/route \d+/g],      // study-specific identifiers to skip when counting
    requireTimezone: false,
  },
  theme: { colors: { blue: "#1D4ED8" } },  // deep-merged over the default theme
  labels: { takeaway: "정리", left: "남은 것" },
  lint: {
    ignore: { "layout-repeat": "user: incident slides share a layout on purpose" },
    severity: { numbers: "error" },
    off: [],
  },
  output: { dir: "build" },
};
```

## Output

| File | Content |
|---|---|
| `<name>.excalidraw` | every slide as a frame; open this |
| `build/slides/NN-<id>.excalidraw` | one frame per file, same elements |
| `build/manifest.json` | slide metadata and hashes |
| `build/outline.md` | generated table of slides |
| `build/render/NN-<id>.png`, `contact-NN.png` | renders and contact sheets |
| `build/render/measure.json`, `render-report.json` | measured widths, renderer and hashes |
| `build/lint.json` | last lint result |
| `review.json` | review ledger (kept at the study root) |

The build is deterministic: the same slides produce byte-identical files, so diffs show real changes.
