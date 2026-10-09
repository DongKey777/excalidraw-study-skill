// Lint engine. Rules read the built files (not the slide modules), so what
// is checked is exactly what Excalidraw will open.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { elementBounds, metaOf, roleOf } from "./scene.mjs";
import { estWidth, MONO, setMetrics } from "./text.mjs";
import { writingProfile } from "./profiles.mjs";

export const RULES = [
  // structure
  { id: "schema", category: "structure", severity: "error", summary: "Excalidraw file shape, element keys, unique ids" },
  { id: "frames", category: "structure", severity: "error", summary: "frames match manifest, grid position, single-slide files equal the combined file" },
  { id: "spec", category: "structure", severity: "error", summary: "every full slide has a takeaway; step and part exist" },
  // layout
  { id: "text-overflow", category: "layout", severity: "error", summary: "a text line is wider than its text element" },
  { id: "frame-escape", category: "layout", severity: "error", summary: "an element leaves its frame" },
  { id: "header-zone", category: "layout", severity: "error", summary: "body content starts inside the title area" },
  { id: "footer-gap", category: "layout", severity: "error", summary: "body content touches the takeaway bar" },
  { id: "text-overlap", category: "layout", severity: "error", summary: "two text runs overlap" },
  { id: "card-spill", category: "layout", severity: "error", summary: "text runs outside the box it starts in, or into a box it does not start in" },
  { id: "shape-overlap", category: "layout", severity: "warn", summary: "two boxes partly overlap (chip collisions, misplaced cards)" },
  { id: "tight-box", category: "layout", severity: "warn", summary: "text inside a box comes within 6px of its top or bottom edge" },
  { id: "card-align", category: "layout", severity: "warn", summary: "side-by-side boxes of the same size start their titles at different heights" },
  { id: "arrow-through-text", category: "layout", severity: "warn", summary: "an arrow or connecting line crosses text" },
  { id: "arrow-through-shape", category: "layout", severity: "warn", summary: "an arrow or connecting line passes through a shape it does not connect" },
  { id: "empty-space", category: "layout", severity: "warn", summary: "a large part of the body area is empty" },
  { id: "sparse-box", category: "layout", severity: "warn", summary: "a box is much larger than the text in it" },
  { id: "orphan", category: "type", severity: "warn", summary: "a wrapped paragraph ends with one short word on its own line" },
  { id: "min-font", category: "type", severity: "warn", summary: "text smaller than the role's minimum" },
  { id: "type-scale", category: "type", severity: "warn", summary: "too many font sizes on one slide" },
  { id: "contrast", category: "color", severity: "warn", summary: "text or arrow contrast too low" },
  { id: "accent-budget", category: "color", severity: "warn", summary: "more than five accent hues on one slide" },
  // deck
  { id: "step-order", category: "deck", severity: "warn", summary: "steps go backwards inside a part, or a part is split" },
  { id: "layout-repeat", category: "deck", severity: "warn", summary: "three or more consecutive slides share one layout" },
  { id: "text-only", category: "deck", severity: "warn", summary: "too many slides are text in boxes with no figure" },
  { id: "density", category: "deck", severity: "warn", summary: "a slide carries too much prose (code excluded)" },
  // writing
  { id: "banned", category: "writing", severity: "error", summary: "banned word or pattern (profile + study.config.mjs)" },
  { id: "dash", category: "writing", severity: "error", summary: "em/en dash in slide text" },
  { id: "emoji", category: "writing", severity: "error", summary: "emoji or pictograph in slide text" },
  { id: "code-ligature", category: "writing", severity: "warn", summary: "code in Cascadia, which draws >=, -> and != as ligatures" },
  { id: "speech-level", category: "writing", severity: "error", summary: "polite endings mixed into plain (~다) text" },
  { id: "connective-comma", category: "writing", severity: "error", summary: "comma right after a connective ending" },
  { id: "title-period", category: "writing", severity: "error", summary: "slide title ends with a period" },
  { id: "style", category: "writing", severity: "warn", summary: "translationese / AI-style signal" },
  { id: "replace", category: "writing", severity: "warn", summary: "term the study prefers to write differently" },
  { id: "variants", category: "writing", severity: "warn", summary: "two spellings of one term in the same study" },
  { id: "contrast-cadence", category: "writing", severity: "warn", summary: "'A가 아니라 B' pattern repeated" },
  { id: "repeated-text", category: "writing", severity: "warn", summary: "same text three or more times on a slide" },
  { id: "numbers", category: "writing", severity: "warn", summary: "too many quantities on one slide (identifiers such as case numbers, PR numbers, dates and versions are not counted)" },
  { id: "timezone", category: "writing", severity: "warn", summary: "clock time without a time zone (opt-in)" },
  { id: "glossary-order", category: "pedagogy", severity: "error", summary: "term used before the slide that explains it" },
  { id: "docs", category: "writing", severity: "warn", summary: "banned word or dash in the study's markdown files" },
  { id: "unfilled", category: "structure", severity: "warn", summary: "brief.md or plan.md is still the template" },
  { id: "takeaway-length", category: "writing", severity: "warn", summary: "the takeaway wraps to a second line" },
  // evidence
  { id: "claims", category: "evidence", severity: "error", summary: "claim id missing from the ledger or not verified" },
  { id: "unsourced-numbers", category: "evidence", severity: "warn", summary: "measured-looking numbers with no source or claims" },
];

const RULE = Object.fromEntries(RULES.map((r) => [r.id, r]));
const NEUTRALS = new Set(["#172033", "#64748B", "#475569", "#CBD5E1", "#94A3B8", "#F8FAFC", "#FFFFFF", "#334155", "#F1F5F9", "TRANSPARENT"]);
const PROSE_SKIP = /^(code|chrome\.step|chrome\.series|chrome\.badge|chrome\.footer\.label|pill\.label|chart\.value|marker\.label)/;
const EMOJI = /\p{Extended_Pictographic}/u;
const UNIT_NUMBER = /\d[\d,.]*\s?(%|ms|초|분|시간|일|배|건|개|번|회|행|MB|GB|TB|KB|kB|MiB|GiB|B\b|s\b|x\b)/g;

function sha(v) {
  return crypto.createHash("sha256").update(v).digest("hex");
}

// colour helpers
function rgb(hex) {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
}
function luminance(hex) {
  const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// context
export function loadLintContext(dir, config) {
  const manifestPath = path.join(dir, config.output.dir, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error("build/manifest.json not found. Run build.mjs first.");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  setMetrics(manifest.metrics ?? null);
  const combinedPath = path.join(dir, manifest.combined);
  const raw = fs.readFileSync(combinedPath, "utf8");
  const combined = JSON.parse(raw);
  const combinedSha = sha(raw);
  const measurePath = path.join(dir, config.output.dir, "render", "measure.json");
  let measured = null;
  if (fs.existsSync(measurePath)) {
    const m = JSON.parse(fs.readFileSync(measurePath, "utf8"));
    if (m.combinedSha256 === combinedSha) measured = m;
  }
  const byFrame = new Map();
  for (const el of combined.elements) {
    const key = el.type === "frame" ? el.id : el.frameId;
    if (!key) continue;
    if (!byFrame.has(key)) byFrame.set(key, []);
    byFrame.get(key).push(el);
  }
  const slides = manifest.slides.map((entry) => {
    const all = byFrame.get(entry.frameId) ?? [];
    const frame = all.find((e) => e.type === "frame");
    const elements = all.filter((e) => e.type !== "frame");
    return { entry, frame, elements, ox: frame?.x ?? 0, oy: frame?.y ?? 0, texts: elements.filter((e) => e.type === "text") };
  });
  return { dir, config, manifest, combined, combinedSha, measured, slides, profile: writingProfile(config) };
}

function widthOf(ctx, el, i, line) {
  const m = ctx.measured?.widths?.[el.id];
  if (m && Number.isFinite(m[i])) return m[i];
  return estWidth(line, el.fontSize, el.fontFamily ?? 2);
}

function glyphBox(ctx, el) {
  const lines = el.text.split("\n");
  const maxLine = Math.max(0, ...lines.map((l, i) => widthOf(ctx, el, i, l)));
  const slack = el.width - maxLine;
  const align = el.textAlign || "left";
  const x0 = el.x + (align === "center" ? slack / 2 : align === "right" ? slack : 0);
  return { x0, x1: x0 + maxLine, y0: el.y, y1: el.y + el.height };
}

const isChrome = (el) => roleOf(el).startsWith("chrome") || roleOf(el) === "frame";

function prose(el) {
  return el.type === "text" && !PROSE_SKIP.test(roleOf(el)) && !MONO.has(el.fontFamily ?? 2);
}

function snippet(s, n = 48) {
  const flat = String(s).replace(/\n/g, " ");
  return flat.length > n ? `${flat.slice(0, n)}…` : flat;
}

// runner
export function runLint(ctx, { docs = true } = {}) {
  const findings = [];
  const ignored = [];
  const configIgnore = ctx.config.lint?.ignore ?? {};
  const disabled = new Set(ctx.config.lint?.off ?? []);
  const severityOverride = ctx.config.lint?.severity ?? {};

  function report(ruleId, { slide, el, message, measuredBy }) {
    if (disabled.has(ruleId)) return;
    const rule = RULE[ruleId];
    const f = {
      rule: ruleId,
      severity: severityOverride[ruleId] ?? rule.severity,
      category: rule.category,
      slide: slide ? slide.entry.number : null,
      slideId: slide ? slide.entry.id : null,
      element: el?.id ?? null,
      message,
    };
    if (measuredBy) f.measuredBy = measuredBy;
    const elIgnore = el ? metaOf(el).lint : null;
    const slideIgnore = slide?.entry.lint;
    const reason = (elIgnore?.ignore?.includes(ruleId) && (elIgnore.reason ?? "element ignore"))
      || (slideIgnore?.ignore?.includes(ruleId) && (slideIgnore.reason ?? "slide ignore"))
      || configIgnore[ruleId];
    if (reason) ignored.push({ ...f, reason });
    else findings.push(f);
  }

  checkStructure(ctx, report);
  checkLayout(ctx, report);
  checkDeck(ctx, report);
  checkWriting(ctx, report);
  checkEvidence(ctx, report);
  if (docs) checkDocs(ctx, report);

  const counts = { error: 0, warn: 0, info: 0 };
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  return {
    generatedBy: "lint.mjs",
    combinedSha256: ctx.combinedSha,
    widths: ctx.measured ? `measured (${ctx.measured.renderer})` : "estimated",
    counts,
    findings,
    ignored,
  };
}

// structure
const REQUIRED = ["id", "type", "x", "y", "width", "height", "angle", "strokeColor", "backgroundColor", "fillStyle",
  "strokeWidth", "strokeStyle", "roughness", "opacity", "groupIds", "seed", "version", "versionNonce", "isDeleted",
  "boundElements", "updated", "locked"];
const TYPES = new Set(["frame", "rectangle", "ellipse", "diamond", "text", "arrow", "line", "image", "freedraw"]);

function checkStructure(ctx, report) {
  const { combined, manifest, dir } = ctx;
  if (combined.type !== "excalidraw" || combined.version !== 2) report("schema", { message: `file type/version is ${combined.type}/${combined.version}, expected excalidraw/2` });
  if (!Array.isArray(combined.elements) || typeof combined.appState !== "object" || typeof combined.files !== "object") report("schema", { message: "elements/appState/files missing" });
  const ids = new Set();
  const frameIds = new Set(combined.elements.filter((e) => e.type === "frame").map((e) => e.id));
  for (const el of combined.elements) {
    if (!TYPES.has(el.type)) report("schema", { message: `unknown element type ${el.type} (${el.id})` });
    for (const k of REQUIRED) if (!(k in el)) report("schema", { message: `${el.id}: missing key ${k}` });
    for (const k of ["x", "y", "width", "height"]) if (!Number.isFinite(el[k])) report("schema", { message: `${el.id}: ${k} is not a number` });
    if (ids.has(el.id)) report("schema", { message: `duplicate id ${el.id}` });
    ids.add(el.id);
    if (el.type === "text" && (typeof el.text !== "string" || el.text !== el.originalText || !Number.isFinite(el.fontSize))) report("schema", { message: `${el.id}: text/originalText/fontSize invalid` });
    if ((el.type === "arrow" || el.type === "line") && (!Array.isArray(el.points) || el.points.length < 2)) report("schema", { message: `${el.id}: points invalid` });
    if (el.frameId && !frameIds.has(el.frameId)) report("schema", { message: `${el.id}: frameId ${el.frameId} does not exist` });
  }

  const { width: W, height: H, columns, gapX, gapY } = manifest.canvas;
  if (frameIds.size !== manifest.slides.length) report("frames", { message: `${frameIds.size} frames vs ${manifest.slides.length} manifest entries` });
  manifest.slides.forEach((s, i) => {
    const slide = ctx.slides[i];
    if (s.number !== i + 1) report("frames", { message: `manifest numbering broken at ${s.id}` });
    if (!slide.frame) return report("frames", { slide, message: `frame ${s.frameId} missing` });
    const ox = (i % columns) * (W + gapX);
    const oy = Math.floor(i / columns) * (H + gapY);
    if (slide.frame.x !== ox || slide.frame.y !== oy || slide.frame.width !== W || slide.frame.height !== H) {
      report("frames", { slide, message: `frame at (${slide.frame.x},${slide.frame.y}) ${slide.frame.width}x${slide.frame.height}, expected (${ox},${oy}) ${W}x${H}` });
    }
    const file = path.join(dir, s.file);
    if (path.isAbsolute(s.file)) report("frames", { slide, message: "manifest path must be relative" });
    if (!fs.existsSync(file)) return report("frames", { slide, message: `single-slide file missing: ${s.file}` });
    const single = JSON.parse(fs.readFileSync(file, "utf8"));
    const mine = [slide.frame, ...slide.elements].filter(Boolean);
    const theirs = single.elements;
    if (JSON.stringify(theirs) !== JSON.stringify(combined.elements.filter((e) => e.id === s.frameId || e.frameId === s.frameId)) || theirs.length !== mine.length) {
      report("frames", { slide, message: `${s.file} differs from the combined file` });
    }
  });
  const slidesDir = path.join(dir, ctx.config.output.dir, "slides");
  if (fs.existsSync(slidesDir)) {
    const files = fs.readdirSync(slidesDir).filter((f) => f.endsWith(".excalidraw"));
    if (files.length !== manifest.slides.length) report("frames", { message: `${files.length} files in build/slides vs ${manifest.slides.length} slides` });
  }
  for (const slide of ctx.slides) {
    if (slide.entry.chrome === "full" && !slide.entry.takeaway) report("spec", { slide, message: "full slide without takeaway (one sentence the reader should keep)" });
  }
}

// layout
function checkLayout(ctx, report) {
  const L = ctx.manifest.layout;
  const measuredBy = ctx.measured ? "measured" : "estimated";
  for (const slide of ctx.slides) {
    const { ox, oy, elements, texts, entry } = slide;
    const W = ctx.manifest.canvas.width;
    const H = ctx.manifest.canvas.height;

    for (const el of texts) {
      el.text.split("\n").forEach((line, i) => {
        if (!line.trim()) return;
        const w = widthOf(ctx, el, i, line);
        if (w > el.width + 0.5) report("text-overflow", { slide, el, measuredBy, message: `${Math.round(w)}px > ${Math.round(el.width)}px at ${el.fontSize}px: "${snippet(line)}"` });
      });
    }

    for (const el of elements) {
      const b = elementBounds(el);
      if (b.x1 < ox - 0.5 || b.y1 < oy - 0.5 || b.x2 > ox + W + 0.5 || b.y2 > oy + H + 0.5) report("frame-escape", { slide, el, message: "element leaves the frame" });
    }

    const body = elements.filter((el) => !isChrome(el));
    if (entry.chrome === "full") {
      const barTop = entry.barY ?? L.footerBottom;
      for (const el of body) {
        const b = elementBounds(el);
        if (b.y1 - oy < L.headerBottom - 0.5) report("header-zone", { slide, el, message: `starts at y=${Math.round(b.y1 - oy)}; body starts at ${L.headerBottom}` });
        if (entry.barY && b.y2 - oy > barTop - L.minFooterGap + 0.5) report("footer-gap", { slide, el, message: `ends at y=${Math.round(b.y2 - oy)}; takeaway bar starts at ${Math.round(barTop)} (keep ${L.minFooterGap}px)` });
      }
    }

    const boxes = texts.map((t) => ({ t, g: glyphBox(ctx, t) }));
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i].g;
        const b = boxes[j].g;
        const ow = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const oh = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        if (ow > 8 && oh > 6) report("text-overlap", { slide, el: boxes[i].t, message: `overlaps ${boxes[j].t.id}: "${snippet(boxes[i].t.text, 24)}" / "${snippet(boxes[j].t.text, 24)}"` });
      }
    }

    const rects = elements.filter((el) => el.type === "rectangle" && !isChrome(el) && (el.opacity ?? 100) >= 100 && !/^(table\.|code\.mark)/.test(roleOf(el)));
    for (const { t, g } of boxes) {
      if (isChrome(t)) continue;
      const ax = g.x0 + 1;
      const ay = (g.y0 + g.y1) / 2;
      let host = null;
      for (const r of rects) {
        const inside = ax >= r.x && ax <= r.x + r.width && ay >= r.y && ay <= r.y + r.height;
        if (inside && (!host || r.width * r.height < host.width * host.height)) host = r;
        if (inside) continue;
        const ow = Math.min(g.x1, r.x + r.width) - Math.max(g.x0, r.x);
        const oh = Math.min(g.y1, r.y + r.height) - Math.max(g.y0, r.y);
        if (ow > 3 && oh > 3) report("card-spill", { slide, el: t, measuredBy, message: `runs ${Math.round(oh)}px into ${r.id}, which it does not start in: "${snippet(t.text, 36)}"` });
      }
      if (!host) continue;
      const over = Math.max(g.y1 - (host.y + host.height), host.y - g.y0, g.x1 - (host.x + host.width), host.x - g.x0);
      if (over > 2) report("card-spill", { slide, el: t, measuredBy, message: `runs ${Math.round(over)}px outside ${host.id}: "${snippet(t.text, 36)}"` });
      else if (host.height >= 40 && Math.min(g.y0 - host.y, host.y + host.height - g.y1) < 6) report("tight-box", { slide, el: t, message: `text is ${Math.round(Math.min(g.y0 - host.y, host.y + host.height - g.y1))}px from the edge of ${host.id}: "${snippet(t.text, 30)}"` });
    }

    const tableRows = elements.filter((el) => el.type === "rectangle" && roleOf(el) === "table.row");
    for (const { t, g } of boxes) {
      if (isChrome(t) || /^table\./.test(roleOf(t))) continue;
      const hit = tableRows.find((r) => Math.min(g.x1, r.x + r.width) - Math.max(g.x0, r.x) > 3 && Math.min(g.y1, r.y + r.height) - Math.max(g.y0, r.y) > 3);
      if (hit) report("card-spill", { slide, el: t, measuredBy, message: `runs into the table (${hit.id}): "${snippet(t.text, 36)}"` });
    }

    for (const r of elements.filter((el) => roleOf(el) === "card.box" && el.height > 200)) {
      const inner = boxes.filter(({ t, g }) => !isChrome(t) && g.x0 + 1 >= r.x && g.x0 + 1 <= r.x + r.width && t.y + 1 >= r.y && t.y + 1 <= r.y + r.height);
      const figures = elements.some((el) => el !== r && el.type !== "text" && !isChrome(el) && el.x >= r.x && el.x <= r.x + r.width && el.y >= r.y && el.y <= r.y + r.height);
      const used = inner.reduce((n, { g }) => n + (g.x1 - g.x0) * (g.y1 - g.y0), 0);
      if (!figures && used / (r.width * r.height) < 0.07) report("sparse-box", { slide, el: r, message: `${Math.round(r.width)}x${Math.round(r.height)} box holds little text (${Math.round((100 * used) / (r.width * r.height))}% filled); size it to its content or add the figure it needs` });
    }
    for (const r of elements.filter((el) => roleOf(el) === "card.box" && el.height > 150)) {
      const inner = boxes.filter(({ t, g }) => !isChrome(t) && g.x0 + 1 >= r.x && g.x0 + 1 <= r.x + r.width && t.y + 1 >= r.y && t.y + 1 <= r.y + r.height);
      if (!inner.length) continue;
      const span = Math.max(...inner.map(({ g }) => g.y1)) - Math.min(...inner.map(({ g }) => g.y0));
      if (span / r.height < 0.45 && r.height - span > 90) report("sparse-box", { slide, el: r, message: `text uses ${Math.round(span)}px of a ${Math.round(r.height)}px tall box; shorten the box to its content (cardHeight) and use the space for the figure` });
    }

    const cards = elements.filter((el) => roleOf(el) === "card.box");
    const titleOf = (r) => texts.find((t) => roleOf(t) === "card.title" && t.x >= r.x && t.x <= r.x + r.width && t.y >= r.y && t.y <= r.y + r.height);
    const flagged = new Set();
    for (let i = 0; i < cards.length; i += 1) {
      for (let j = i + 1; j < cards.length; j += 1) {
        const a = cards[i];
        const b = cards[j];
        const row = `${Math.round(a.y)}:${Math.round(a.height)}`;
        if (Math.abs(a.y - b.y) > 1 || Math.abs(a.height - b.height) > 1 || flagged.has(row)) continue;
        const ta = titleOf(a);
        const tb = titleOf(b);
        if (!ta || !tb || Math.abs(ta.y - tb.y) <= 4) continue;
        flagged.add(row);
        report("card-align", { slide, el: a, message: `titles of ${a.id} and ${b.id} start ${Math.round(Math.abs(ta.y - tb.y))}px apart; use valign: "top" so a row of cards reads across` });
      }
    }

    const solid = elements.filter((el) => (el.type === "rectangle" || el.type === "ellipse") && !isChrome(el) && !/^(table\.|code\.mark)/.test(roleOf(el)));
    for (let i = 0; i < solid.length; i += 1) {
      for (let j = i + 1; j < solid.length; j += 1) {
        const a = solid[i];
        const b = solid[j];
        const ow = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const oh = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (ow <= 2 || oh <= 2) continue;
        const contains = (p, q) => p.x <= q.x + 1 && p.y <= q.y + 1 && p.x + p.width >= q.x + q.width - 1 && p.y + p.height >= q.y + q.height - 1;
        if (contains(a, b) || contains(b, a)) continue;
        report("shape-overlap", { slide, el: a, message: `partly overlaps ${b.id} (${Math.round(ow)}x${Math.round(oh)}px)` });
      }
    }

    // Lines count as connectors when both ends touch a shape (graph edges, brackets to boxes);
    // axes, rules and dividers end in empty space and are left alone.
    const anyShape = elements.filter((el) => (el.type === "rectangle" || el.type === "ellipse") && !isChrome(el) && !/^(code\.mark|table\.)/.test(roleOf(el)));
    // The smallest shape an end point touches; a line whose two ends sit in the same shape is a divider.
    const touched = (p) => {
      let best = null;
      for (const sh of anyShape) {
        if (p[0] >= sh.x - 12 && p[0] <= sh.x + sh.width + 12 && p[1] >= sh.y - 12 && p[1] <= sh.y + sh.height + 12 && (!best || sh.width * sh.height < best.width * best.height)) best = sh;
      }
      return best;
    };
    const connector = (el) => {
      if (el.type !== "line" || isChrome(el) || /^table\./.test(roleOf(el)) || !Array.isArray(el.points) || el.points.length < 2) return false;
      const a = el.points[0];
      const b = el.points[el.points.length - 1];
      const sa = touched([el.x + a[0], el.y + a[1]]);
      const sb = touched([el.x + b[0], el.y + b[1]]);
      return Boolean(sa && sb && sa !== sb);
    };
    const arrows = elements.filter((el) => (el.type === "arrow" && !isChrome(el)) || connector(el));
    for (const ar of arrows) {
      for (const { t, g } of boxes) {
        if (isChrome(t)) continue;
        const box = { x0: g.x0 + 3, x1: g.x1 - 3, y0: g.y0 + 3, y1: g.y1 - 3 };
        if (box.x1 <= box.x0 || box.y1 <= box.y0) continue;
        for (let k = 1; k < ar.points.length; k += 1) {
          const p = [ar.x + ar.points[k - 1][0], ar.y + ar.points[k - 1][1]];
          const q = [ar.x + ar.points[k][0], ar.y + ar.points[k][1]];
          if (segmentHitsBox(p, q, box)) {
            report("arrow-through-text", { slide, el: ar, message: `crosses "${snippet(t.text, 30)}"` });
            break;
          }
        }
      }
    }

    const shapes = elements.filter((el) => (el.type === "rectangle" || el.type === "ellipse") && !isChrome(el) && !/^(code\.mark|table\.fill)/.test(roleOf(el)));
    for (const ar of arrows) {
      const pts = ar.points.map(([px, py]) => [ar.x + px, ar.y + py]);
      const start = pts[0];
      const end = pts[pts.length - 1];
      for (const sh of shapes) {
        const near = (p, pad) => p[0] >= sh.x - pad && p[0] <= sh.x + sh.width + pad && p[1] >= sh.y - pad && p[1] <= sh.y + sh.height + pad;
        if (near(start, 12) || near(end, 12)) continue;
        if (pts.every((p) => near(p, 0))) continue;
        const box = { x0: sh.x + 4, x1: sh.x + sh.width - 4, y0: sh.y + 4, y1: sh.y + sh.height - 4 };
        if (box.x1 <= box.x0 || box.y1 <= box.y0) continue;
        let hit = false;
        for (let k = 1; k < pts.length && !hit; k += 1) hit = segmentHitsBox(pts[k - 1], pts[k], box);
        if (hit) report("arrow-through-shape", { slide, el: ar, message: `passes through ${sh.id}` });
      }
    }

    if (entry.chrome === "full") {
      const top = L.headerBottom;
      const bottom = (entry.barY ?? L.footerBottom) - L.footerGap;
      const bs = body.map((el) => (el.type === "text" ? (() => { const g = glyphBox(ctx, el); return { x1: g.x0, x2: g.x1, y1: g.y0, y2: g.y1 }; })() : elementBounds(el)));
      const hole = largestEmpty(bs.map((b) => ({ x1: b.x1 - ox, x2: b.x2 - ox, y1: b.y1 - oy, y2: b.y2 - oy })), { x: L.margin, y: top, w: L.contentWidth, h: bottom - top });
      const area = L.contentWidth * (bottom - top);
      if (!body.length) report("empty-space", { slide, message: "slide has no body content" });
      else if (hole && hole.w >= 240 && hole.h >= 160 && hole.w * hole.h > area * 0.15) {
        report("empty-space", { slide, message: `empty ${hole.w}x${hole.h}px area at x=${hole.x}..${hole.x + hole.w}, y=${hole.y}..${hole.y + hole.h} (${Math.round((100 * hole.w * hole.h) / area)}% of the body)` });
      }
    }

    const take = texts.find((t) => roleOf(t) === "chrome.takeaway");
    if (take && take.text.includes("\n")) report("takeaway-length", { slide, el: take, message: `takeaway takes ${take.text.split("\n").length} lines; keep it to one sentence that fits one line: "${snippet(take.text.replace(/\n/g, " "), 40)}"` });

    for (const t of texts) {
      if (!prose(t) || /^(table\.|chrome\.(badge|step|series|source))/.test(roleOf(t))) continue;
      const lines = t.text.split("\n");
      if (lines.length < 2) continue;
      const last = lines[lines.length - 1].trim();
      const prev = lines[lines.length - 2].trim();
      if (!last || last.includes(" ") || !prev || /\d/.test(last)) continue;
      const w = widthOf(ctx, t, lines.length - 1, last);
      if (w < t.width * 0.15 && widthOf(ctx, t, lines.length - 2, prev) > t.width * 0.6) report("orphan", { slide, el: t, message: `"${last}" is alone on the last line; reword or change the width` });
    }

    const sizes = new Set();
    for (const t of texts) {
      const role = roleOf(t);
      const shortLabel = !t.text.includes("\n") && [...t.text].length <= 16;
      const min = /^(chrome\.source|meta)/.test(role) ? 12 : /^(code)/.test(role) ? 14 : /(label|chip|step|badge|pill|at$)/.test(role) || shortLabel ? 14 : 15;
      if (t.fontSize < min) report("min-font", { slide, el: t, message: `${t.fontSize}px < ${min}px for ${role}: "${snippet(t.text, 30)}"` });
      if (!isChrome(t)) sizes.add(t.fontSize);
    }
    if (sizes.size > 6) report("type-scale", { slide, message: `${sizes.size} font sizes in the body (${[...sizes].sort((a, b) => a - b).join(", ")})` });

    const surface = elements.find((e) => roleOf(e) === "chrome.background")?.backgroundColor ?? "#FFFFFF";
    const fills = elements.filter((el) => (el.type === "rectangle" || el.type === "ellipse") && (el.opacity ?? 100) >= 100 && el.backgroundColor !== "transparent" && roleOf(el) !== "chrome.background");
    for (const t of texts) {
      if (!t.text.trim() || !/^#[0-9a-f]{3,6}$/i.test(t.strokeColor)) continue;
      const g = glyphBox(ctx, t);
      const cx = (g.x0 + g.x1) / 2;
      const cy = t.y + Math.min(t.height, t.fontSize) / 2;
      let bg = surface;
      let area = Infinity;
      for (const r of fills) {
        if (cx >= r.x && cx <= r.x + r.width && cy >= r.y && cy <= r.y + r.height && r.width * r.height < area) {
          bg = r.backgroundColor;
          area = r.width * r.height;
        }
      }
      if (!/^#[0-9a-f]{3,6}$/i.test(bg)) continue;
      const ratio = contrastRatio(t.strokeColor, bg);
      const need = t.fontSize >= 24 ? 3 : 4.5;
      if (ratio < need) report("contrast", { slide, el: t, message: `text ${t.strokeColor} on ${bg} is ${ratio.toFixed(2)}:1 (< ${need}): "${snippet(t.text, 24)}"` });
    }
    for (const ar of arrows) {
      if (!/^#[0-9a-f]{3,6}$/i.test(ar.strokeColor)) continue;
      const ratio = contrastRatio(ar.strokeColor, surface);
      if (ratio < 3) report("contrast", { slide, el: ar, message: `arrow ${ar.strokeColor} on ${surface} is ${ratio.toFixed(2)}:1 (< 3)` });
    }

    const accents = new Set();
    for (const el of body) {
      if (el.type === "text" || roleOf(el).startsWith("code")) continue;
      for (const c of [el.strokeColor, el.backgroundColor]) {
        const hex = String(c).toUpperCase();
        if (!NEUTRALS.has(hex) && hex !== "TRANSPARENT") accents.add(hueFamily(hex));
      }
    }
    if (accents.size > 5) report("accent-budget", { slide, message: `${accents.size} accent hues (${[...accents].join(", ")}); keep each color's meaning fixed` });
  }
}

// Largest axis-aligned empty rectangle inside `area`, on a 20px grid.
export function largestEmpty(boxes, area, cell = 20) {
  const cols = Math.floor(area.w / cell);
  const rows = Math.floor(area.h / cell);
  if (cols <= 0 || rows <= 0) return null;
  const filled = Array.from({ length: rows }, () => new Uint8Array(cols));
  for (const b of boxes) {
    const c0 = Math.max(0, Math.floor((b.x1 - area.x) / cell));
    const c1 = Math.min(cols - 1, Math.ceil((b.x2 - area.x) / cell) - 1);
    const r0 = Math.max(0, Math.floor((b.y1 - area.y) / cell));
    const r1 = Math.min(rows - 1, Math.ceil((b.y2 - area.y) / cell) - 1);
    for (let r = r0; r <= r1; r += 1) for (let c = c0; c <= c1; c += 1) filled[r][c] = 1;
  }
  const heights = new Array(cols).fill(0);
  let best = null;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) heights[c] = filled[r][c] ? 0 : heights[c] + 1;
    const stack = [];
    for (let c = 0; c <= cols; c += 1) {
      const h = c === cols ? 0 : heights[c];
      let start = c;
      while (stack.length && stack[stack.length - 1][1] >= h) {
        const [s0, sh] = stack.pop();
        const a = sh * (c - s0);
        if (sh > 0 && (!best || a > best.a)) best = { a, c0: s0, c1: c, r1: r + 1, r0: r + 1 - sh };
        start = s0;
      }
      stack.push([start, h]);
    }
  }
  if (!best) return null;
  return { x: area.x + best.c0 * cell, y: area.y + best.r0 * cell, w: (best.c1 - best.c0) * cell, h: (best.r1 - best.r0) * cell };
}

// Group shades of one hue (blue, blueSoft, blueText) so a tone counts once.
function hueFamily(hex) {
  const [r, g, b] = rgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 0.08) return "gray";
  let h;
  if (max === r) h = ((g - b) / (max - min)) % 6;
  else if (max === g) h = (b - r) / (max - min) + 2;
  else h = (r - g) / (max - min) + 4;
  const deg = (h * 60 + 360) % 360;
  const names = [[15, "red"], [45, "orange"], [70, "yellow"], [160, "green"], [200, "teal"], [255, "blue"], [300, "purple"], [345, "pink"], [360, "red"]];
  return names.find(([limit]) => deg < limit)[1];
}

function segmentHitsBox(p, q, b) {
  const inside = (x, y) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1;
  if (inside(...p) || inside(...q)) return true;
  const steps = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 4);
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (inside(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)) return true;
  }
  return false;
}

// deck
const FIGURE_ROLES = /^(connector|shape|code|table\.|page\.|marker\.|chart\.|rule)/;

function checkDeck(ctx, report) {
  const steps = ctx.manifest.steps ?? [];
  const seenParts = new Set();
  let prev = null;
  for (const slide of ctx.slides) {
    const { entry } = slide;
    if (prev && entry.part && entry.part === prev.entry.part && entry.step && prev.entry.step) {
      if (steps.indexOf(entry.step) < steps.indexOf(prev.entry.step)) report("step-order", { slide, message: `${prev.entry.step} → ${entry.step} goes backwards inside part ${entry.part}` });
    }
    if (entry.part && seenParts.has(entry.part) && prev?.entry.part !== entry.part) report("step-order", { slide, message: `part ${entry.part} appears again after other parts` });
    if (entry.part) seenParts.add(entry.part);
    prev = slide;
  }

  const signature = (slide) => slide.elements
    .filter((el) => /^(card\.box|code\.box|table\.row)$/.test(roleOf(el)))
    .map((el) => `${Math.round((el.x - slide.ox) / 120)},${Math.round((el.y - slide.oy) / 120)},${Math.round(el.width / 120)},${Math.round(el.height / 120)}`)
    .sort()
    .join("|");
  let run = [];
  const flush = () => {
    if (run.length >= 3) report("layout-repeat", { slide: run[0], message: `slides ${run.map((s) => s.entry.number).join(", ")} share one layout; vary the figure where the content differs` });
  };
  for (const slide of ctx.slides) {
    const sig = slide.entry.chrome === "full" ? signature(slide) : "";
    if (sig && run.length && signature(run[run.length - 1]) === sig) run.push(slide);
    else {
      flush();
      run = sig ? [slide] : [];
    }
  }
  flush();

  const full = ctx.slides.filter((s) => s.entry.chrome === "full");
  const textOnly = full.filter((s) => !s.elements.some((el) => !isChrome(el) && el.type !== "text" && FIGURE_ROLES.test(roleOf(el))));
  if (full.length >= 5 && textOnly.length / full.length > 0.4) {
    report("text-only", { message: `${textOnly.length}/${full.length} slides are text in boxes with no figure: ${textOnly.map((s) => s.entry.number).join(", ")}` });
  }

  let denseRun = [];
  for (const slide of full) {
    const chars = slide.texts.filter((t) => !isChrome(t) && prose(t)).reduce((n, t) => n + t.text.replace(/\s/g, "").length, 0);
    if (chars > 520) report("density", { slide, message: `${chars} characters of body text; split the slide or move detail to notes` });
    denseRun = chars > 380 ? [...denseRun, slide] : [];
    if (denseRun.length === 3) report("density", { slide, message: `slides ${denseRun.map((s) => s.entry.number).join(", ")} are dense in a row; give the reader a lighter slide` });
  }
}

// writing
function checkWriting(ctx, report) {
  const P = ctx.profile;
  const glossary = ctx.config.glossary ?? {};
  const indexOf = new Map(ctx.slides.map((s, i) => [s.entry.id, i]));
  const variantHits = P.variants.map(() => new Map());

  ctx.slides.forEach((slide, si) => {
    let contrasts = 0;
    let numbers = 0;
    const counts = new Map();
    for (const t of slide.texts) {
      const role = roleOf(t);
      const flat = t.text.replace(/\n/g, " ");
      if (t.fontFamily === 3 && /(>=|<=|!=|->|=>|==|<>)/.test(t.text)) report("code-ligature", { slide, el: t, message: `Cascadia (fontFamily 3) draws ${t.text.match(/(>=|<=|!=|->|=>|==|<>)/)[0]} as a ligature; use the default code font (fontFamily 8)` });
      if (MONO.has(t.fontFamily ?? 2) || role === "code") continue;
      for (const r of P.fail) {
        const m = flat.match(r.re);
        if (m) report("banned", { slide, el: t, message: `"${m[0]}": ${r.why} | "${snippet(flat)}"` });
      }
      if (/[—–]/.test(flat)) report("dash", { slide, el: t, message: `dash in "${snippet(flat)}"; use ·, ~ or → or split the sentence` });
      if (EMOJI.test(flat)) report("emoji", { slide, el: t, message: `pictograph in "${snippet(flat)}"` });
      if (!prose(t)) continue;
      if (P.register === "plain" && P.speechLevel) {
        for (const sentence of flat.split(/(?<=[.!?])\s+/)) {
          if (sentence.trim() && P.speechLevel(sentence.trim())) report("speech-level", { slide, el: t, message: `polite ending in "${snippet(sentence)}"; write ~다` });
        }
      }
      if (P.connective && P.connectiveComma !== "off") {
        const m = flat.match(P.connective);
        if (m) report("connective-comma", { slide, el: t, message: `"${m[0].trim()}" in "${snippet(flat)}"` });
      }
      if (role === "chrome.title" && /\.\s*$/.test(t.text)) report("title-period", { slide, el: t, message: `title ends with a period: "${snippet(flat)}"` });
      for (const r of P.warn) {
        const m = flat.match(r.re);
        if (m && !(ctx.config.writing?.allow ?? []).some((a) => flat.includes(a) && a.includes(m[0]))) report("style", { slide, el: t, message: `"${m[0]}": ${r.why}` });
      }
      for (const r of P.replace) {
        const m = flat.match(r.re);
        if (m) report("replace", { slide, el: t, message: `"${m[0]}" → "${r.to}" | "${snippet(flat)}"` });
      }
      P.variants.forEach((pair, vi) => {
        for (const v of pair) if (flat.includes(v)) variantHits[vi].set(v, slide.entry.number);
      });
      if (P.contrast) contrasts += (flat.match(P.contrast) || []).length;
      if (!/^chrome\.(source)/.test(role)) numbers += (P.identifiers.reduce((acc, re) => acc.replace(re, " "), flat).match(P.numberPattern) || []).length;
      if (!isChrome(t) && !role.startsWith("table.") && flat.trim().length >= 10) counts.set(flat.trim(), (counts.get(flat.trim()) ?? 0) + 1);
      if (P.requireTimezone && /\b\d{1,2}:\d{2}\b/.test(flat) && !/(KST|UTC|GMT|[+-]\d{2}:?\d{2})/.test(`${flat} ${slide.entry.subtitle} ${slide.entry.source}`)) {
        report("timezone", { slide, el: t, message: `clock time without a time zone: "${snippet(flat)}"` });
      }
    }
    if (contrasts > P.maxContrastPerSlide) report("contrast-cadence", { slide, message: `"A가 아니라 B" pattern ${contrasts} times on one slide` });
    if (numbers > P.maxNumbersPerSlide) report("numbers", { slide, message: `${numbers} quantities on one slide (limit ${P.maxNumbersPerSlide}); keep the ones that help understanding` });
    for (const [text, n] of counts) if (n >= 3) report("repeated-text", { slide, message: `"${snippet(text, 30)}" appears ${n} times` });

    for (const [term, definedIn] of Object.entries(glossary)) {
      const def = indexOf.get(definedIn);
      if (def === undefined) {
        if (si === 0) report("glossary-order", { message: `glossary term "${term}" points to unknown slide id "${definedIn}"` });
        continue;
      }
      if (si >= def || slide.entry.chrome === "cover") continue;
      const re = /^[\x20-\x7e]+$/.test(term) ? new RegExp(`(^|[^A-Za-z0-9_])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z0-9_]|$)`) : new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      const hit = slide.texts.find((t) => roleOf(t) !== "chrome.source" && prose(t) && re.test(t.text.replace(/\n/g, " ")));
      if (hit) report("glossary-order", { slide, el: hit, message: `"${term}" is used before slide ${def + 1} (${definedIn}) explains it` });
    }
  });
  P.variants.forEach((_, vi) => {
    if (variantHits[vi].size > 1) report("variants", { message: `both ${[...variantHits[vi].entries()].map(([v, n]) => `"${v}" (slide ${n})`).join(" and ")}; pick one` });
  });
}

// evidence
export function readLedger(dir) {
  const md = path.join(dir, "evidence", "claims.md");
  const json = path.join(dir, "evidence", "claims.json");
  const claims = new Map();
  if (fs.existsSync(json)) {
    for (const c of JSON.parse(fs.readFileSync(json, "utf8"))) claims.set(c.id, c);
  } else if (fs.existsSync(md)) {
    const lines = fs.readFileSync(md, "utf8").split("\n").filter((l) => l.trim().startsWith("|"));
    const cells = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim());
    const header = lines[0] ? cells(lines[0]).map((h) => h.toLowerCase()) : [];
    const statusCol = header.findIndex((h) => /^(status|상태)$/.test(h));
    for (const line of lines.slice(1)) {
      const row = cells(line);
      if (!row[0] || /^-+$/.test(row[0].replace(/:/g, ""))) continue;
      claims.set(row[0], { id: row[0], status: statusCol >= 0 ? row[statusCol] : "" });
    }
  }
  return claims;
}

const OK_STATUS = /^(verified|measured|documented|derived|확인|실측|문서|계산)/i;

function checkEvidence(ctx, report) {
  const ledger = readLedger(ctx.dir);
  for (const slide of ctx.slides) {
    for (const id of slide.entry.claims ?? []) {
      const c = ledger.get(id);
      if (!c) report("claims", { slide, message: `claim ${id} is not in evidence/claims.md` });
      else if (c.status !== undefined && c.status !== "" && !OK_STATUS.test(c.status)) report("claims", { slide, message: `claim ${id} has status "${c.status}"; verify it before it goes on a slide` });
      else if (c.status === "") report("claims", { slide, message: `claim ${id} has no status` });
    }
    const unitNumbers = slide.texts.filter((t) => prose(t) && roleOf(t) !== "chrome.source").reduce((n, t) => n + (t.text.match(UNIT_NUMBER) || []).length, 0);
    if (unitNumbers >= 3 && !slide.entry.source && !(slide.entry.claims ?? []).length) report("unsourced-numbers", { slide, message: `${unitNumbers} measured-looking numbers but no source or claims` });
  }
}

// docs
function checkDocs(ctx, report) {
  const files = fs.readdirSync(ctx.dir).filter((f) => f.endsWith(".md"));
  for (const f of ["brief.md", "plan.md"]) {
    const file = path.join(ctx.dir, f);
    if (fs.existsSync(file) && fs.readFileSync(file, "utf8").includes("excalidraw-study:template")) {
      report("unfilled", { message: `${f} still has the template marker; write it (phase ${f === "brief.md" ? 0 : 2}) and delete the marker line` });
    }
  }
  for (const f of files) {
    const text = fs.readFileSync(path.join(ctx.dir, f), "utf8");
    text.split("\n").forEach((raw, i) => {
      if (raw.startsWith("    ") || raw.startsWith("```") || raw.trimStart().startsWith(">")) return;
      const line = raw.replace(/"[^"]*"|“[^”]*”|`[^`]*`/g, "");
      for (const r of ctx.profile.fail) {
        const m = line.match(r.re);
        if (m) report("docs", { message: `${f}:${i + 1} "${m[0]}": ${r.why}` });
      }
      if (/[—–]/.test(line)) report("docs", { message: `${f}:${i + 1} dash` });
    });
  }
}

export function formatReport(result, { manifest, verbose = false } = {}) {
  const out = [];
  const bySlide = new Map();
  for (const f of result.findings) {
    const key = f.slide ?? 0;
    if (!bySlide.has(key)) bySlide.set(key, []);
    bySlide.get(key).push(f);
  }
  const keys = [...bySlide.keys()].sort((a, b) => a - b);
  for (const k of keys) {
    const head = k === 0 ? "study" : `slide ${k} ${manifest?.slides[k - 1]?.id ?? ""}`;
    out.push(head);
    for (const f of bySlide.get(k)) {
      if (f.severity === "info" && !verbose) continue;
      out.push(`  ${f.severity === "error" ? "ERROR" : f.severity.toUpperCase().padEnd(5)} ${f.rule.padEnd(18)} ${f.message}${f.element ? `  [${f.element}]` : ""}`);
    }
  }
  if (result.ignored.length) out.push(`ignored ${result.ignored.length} finding(s) with recorded reasons (see lint.json)`);
  out.push(`widths: ${result.widths}`);
  out.push(`${result.counts.error} error(s), ${result.counts.warn} warning(s)`);
  return out.join("\n");
}
