// Text metrics shared by the kit (layout) and the linter (checks).
// The estimate is deliberately simple and a little generous: wide glyphs
// (Hangul, CJK, full-width forms) count as 1.0em, everything else 0.55em;
// monospace uses 1.2em / 0.6em. The real Excalidraw render in render.mjs
// measures the same text in a browser and replaces these numbers.

export const FAMILY = { handwritten: 1, sans: 2, cascadia: 3, excalifont: 5, nunito: 6, comicShanns: 8 };
// Monospace families. Cascadia (3) draws >=, -> and != as ligatures;
// Comic Shanns (8, Excalidraw's current code font) does not.
export const MONO = new Set([3, 8]);

export function isWideChar(ch) {
  const c = ch.codePointAt(0);
  return (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) ||
    (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) ||
    (c >= 0xffe0 && c <= 0xffe6) || (c >= 0x1f300 && c <= 0x1faff) ||
    (c >= 0x20000 && c <= 0x3fffd);
}

// Width factors in em. The defaults are deliberately generous so text fits
// before anything has been measured. After a render, render.mjs fits these
// to the widths Excalidraw actually laid out (build/metrics.json) and the
// next build wraps with them; floors keep a margin for other systems' fonts.
export const DEFAULT_METRICS = Object.freeze({ wide: 1.0, narrow: 0.55, monoWide: 1.2, monoNarrow: 0.6 });
const LIMITS = { wide: [0.88, 1.15], narrow: [0.5, 0.65], monoWide: [1.0, 1.3], monoNarrow: [0.55, 0.7] };
let metrics = { ...DEFAULT_METRICS };

export function setMetrics(m) {
  metrics = { ...DEFAULT_METRICS };
  for (const k of Object.keys(DEFAULT_METRICS)) if (typeof m?.[k] === "number") metrics[k] = m[k];
}

export function getMetrics() {
  return { ...metrics };
}

// samples: [{ text, size, family, width }] for single lines. Least squares
// for width = size * (a * wideChars + b * narrowChars), per family group,
// plus a 3% margin, clamped to LIMITS. Too few samples keep the default.
export function fitMetrics(samples) {
  const fit = (group) => {
    let sww = 0, swn = 0, snn = 0, swy = 0, sny = 0, n = 0, wideLines = 0;
    for (const s of group) {
      let W = 0, N = 0;
      for (const ch of s.text) (isWideChar(ch) ? W++ : N++);
      const x1 = s.size * W;
      const x2 = s.size * N;
      sww += x1 * x1; swn += x1 * x2; snn += x2 * x2; swy += x1 * s.width; sny += x2 * s.width; n += 1;
      if (W >= 3) wideLines += 1;
    }
    const det = sww * snn - swn * swn;
    if (n < 20 || Math.abs(det) < 1e-9) return null;
    return { a: (swy * snn - sny * swn) / det, b: (sww * sny - swn * swy) / det, wideLines };
  };
  const clamp = (k, v) => Math.min(LIMITS[k][1], Math.max(LIMITS[k][0], Math.round(v * 1.03 * 1000) / 1000));
  const out = { ...DEFAULT_METRICS };
  const sans = fit(samples.filter((s) => !MONO.has(s.family)));
  if (sans) {
    if (sans.wideLines >= 10) out.wide = clamp("wide", sans.a);
    out.narrow = clamp("narrow", sans.b);
  }
  const mono = fit(samples.filter((s) => MONO.has(s.family)));
  if (mono) {
    if (mono.wideLines >= 10) out.monoWide = clamp("monoWide", mono.a);
    out.monoNarrow = clamp("monoNarrow", mono.b);
  }
  return out;
}

export function estWidth(value, size, family = 2) {
  const wide = MONO.has(family) ? metrics.monoWide : metrics.wide;
  const narrow = MONO.has(family) ? metrics.monoNarrow : metrics.narrow;
  let w = 0;
  for (const ch of value) w += (isWideChar(ch) ? wide : narrow) * size;
  return w;
}

export function maxLineWidth(value, size, family = 2) {
  return Math.max(0, ...String(value).split("\n").map((l) => estWidth(l, size, family)));
}

export function lineCount(value) {
  return value ? String(value).split("\n").length : 0;
}

// In Korean text a run of Latin words is usually one term ("Seq Scan",
// "Bitmap Heap Scan은"). Keep up to three such words together when wrapping;
// a run wider than the line is split again.
const GLUE = "\u00a0";
function units(value, size, maxWidth, family) {
  const words = value.split(" ");
  if (![...value].some(isWideChar)) return words;
  const out = [];
  for (const word of words) {
    const prev = out[out.length - 1];
    const glue = prev !== undefined && /^[A-Za-z][A-Za-z0-9_.-]*$/.test(prev.split(GLUE).pop())
      && /^[A-Za-z]/.test(word) && prev.split(GLUE).length < 3;
    if (glue) out[out.length - 1] = `${prev}${GLUE}${word}`;
    else out.push(word);
  }
  return out.flatMap((u) => (u.includes(GLUE) && estWidth(u, size, family) > maxWidth ? u.split(GLUE) : [u]));
}

function greedy(value, size, maxWidth, family) {
  const lines = [];
  let cur = "";
  for (const word of units(value, size, maxWidth, family)) {
    const next = cur ? `${cur} ${word}` : word;
    if (!cur || estWidth(next, size, family) <= maxWidth) {
      cur = next;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur || lines.length === 0) lines.push(cur);
  return lines.map((line) => line.split(GLUE).join(" "));
}

// Wrap one paragraph at spaces (eojeol boundaries for Korean) so that each
// line fits maxWidth. A single word longer than maxWidth stays on its own line;
// the linter reports it instead of silently breaking inside a word. When the
// last line would hold one word or be much shorter than the line before it,
// narrower widths are tried so the lines even out without adding a line.
export function wrapParagraph(value, size, maxWidth, family = 2) {
  const first = greedy(value, size, maxWidth, family);
  // Ragged: the last line holds one word, or is under a third of the line before it.
  const ragged = (ls) => ls.length >= 2 && (!ls[ls.length - 1].includes(" ")
    || estWidth(ls[ls.length - 1], size, family) < estWidth(ls[ls.length - 2], size, family) / 3);
  if (!ragged(first)) return first;
  for (let w = maxWidth * 0.98; w >= maxWidth * 0.6; w -= maxWidth * 0.02) {
    const cand = greedy(value, size, w, family);
    if (cand.length > first.length) break;
    if (!ragged(cand)) return cand;
  }
  return first;
}

// Wrap text that may already contain explicit line breaks. Explicit breaks
// are kept; only lines that are too wide are re-wrapped.
export function wrapText(value, size, maxWidth, family = 2) {
  return String(value)
    .split("\n")
    .flatMap((para) => (estWidth(para, size, family) <= maxWidth ? [para] : wrapParagraph(para, size, maxWidth, family)))
    .join("\n");
}

// Largest size in [min, size] at which `value` fits in maxWidth x maxHeight
// after wrapping. Returns { size, text, fits }.
export function fitText(value, { size, min = size, maxWidth, maxHeight = Infinity, lineHeight = 1.25, family = 2, wrap = true }) {
  for (let s = size; s >= min; s -= 1) {
    const text = wrap ? wrapText(value, s, maxWidth, family) : String(value);
    const h = lineCount(text) * s * lineHeight;
    if (maxLineWidth(text, s, family) <= maxWidth && h <= maxHeight) return { size: s, text, fits: true };
  }
  const text = wrap ? wrapText(value, min, maxWidth, family) : String(value);
  return { size: min, text, fits: false };
}

export function textHeight(value, size, lineHeight = 1.25) {
  return Math.ceil(size * lineHeight * Math.max(1, lineCount(value)));
}
