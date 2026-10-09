// Default visual system. A study overrides any part of it through
// `theme` in study.config.mjs; mergeTheme() deep-merges the override.

export const COLORS = {
  ink: "#172033",
  muted: "#64748B",
  line: "#CBD5E1",
  surface: "#F8FAFC",
  white: "#FFFFFF",
  slate: "#334155",
  slateSoft: "#F1F5F9",
  blue: "#2563EB",
  blueSoft: "#DBEAFE",
  teal: "#0F766E",
  tealSoft: "#CCFBF1",
  green: "#15803D",
  greenSoft: "#DCFCE7",
  orange: "#EA580C",
  orangeSoft: "#FFEDD5",
  purple: "#7E22CE",
  purpleSoft: "#F3E8FF",
  red: "#DC2626",
  redSoft: "#FEE2E2",
  yellow: "#A16207",
  yellowSoft: "#FEF9C3",
  // Darker text shades: accent text on a soft fill must reach 4.5:1.
  redText: "#B91C1C",
  orangeText: "#C2410C",
  blueText: "#1D4ED8",
  mutedStrong: "#475569",
  yellowText: "#854D0E",
};

const C = COLORS;

// Tones carry meaning and must mean the same thing on every slide.
export const TONES = {
  problem: { fill: C.redSoft, stroke: C.red, title: C.redText },
  fix: { fill: C.greenSoft, stroke: C.green, title: C.green },
  note: { fill: C.yellowSoft, stroke: C.yellow, title: C.yellow },
  info: { fill: C.blueSoft, stroke: C.blue, title: C.blueText },
  concept: { fill: C.tealSoft, stroke: C.teal, title: C.teal },
  memory: { fill: C.purpleSoft, stroke: C.purple, title: C.purple },
  warn: { fill: C.orangeSoft, stroke: C.orange, title: C.orangeText },
  plain: { fill: C.white, stroke: C.line, title: C.ink },
  muted: { fill: C.slateSoft, stroke: C.slate, title: C.slate },
};

export const STEP_PRESETS = {
  "case-first-ko": [
    { name: "상황", color: C.orangeText, soft: C.orangeSoft },
    { name: "분석", color: C.blueText, soft: C.blueSoft },
    { name: "원리", color: C.purple, soft: C.purpleSoft },
    { name: "해결", color: C.green, soft: C.greenSoft },
  ],
  "case-first-en": [
    { name: "Situation", color: C.orangeText, soft: C.orangeSoft },
    { name: "Analysis", color: C.blueText, soft: C.blueSoft },
    { name: "Principle", color: C.purple, soft: C.purpleSoft },
    { name: "Fix", color: C.green, soft: C.greenSoft },
  ],
  "concept-first-ko": [
    { name: "질문", color: C.orangeText, soft: C.orangeSoft },
    { name: "개념", color: C.purple, soft: C.purpleSoft },
    { name: "동작", color: C.blueText, soft: C.blueSoft },
    { name: "적용", color: C.green, soft: C.greenSoft },
  ],
  "concept-first-en": [
    { name: "Question", color: C.orangeText, soft: C.orangeSoft },
    { name: "Concept", color: C.purple, soft: C.purpleSoft },
    { name: "Mechanism", color: C.blueText, soft: C.blueSoft },
    { name: "Apply", color: C.green, soft: C.greenSoft },
  ],
  "comparison-ko": [
    { name: "질문", color: C.orangeText, soft: C.orangeSoft },
    { name: "기준", color: C.purple, soft: C.purpleSoft },
    { name: "비교", color: C.blueText, soft: C.blueSoft },
    { name: "고르기", color: C.green, soft: C.greenSoft },
  ],
  "comparison-en": [
    { name: "Question", color: C.orangeText, soft: C.orangeSoft },
    { name: "Criteria", color: C.purple, soft: C.purpleSoft },
    { name: "Compare", color: C.blueText, soft: C.blueSoft },
    { name: "Choose", color: C.green, soft: C.greenSoft },
  ],
  none: [],
};

export const LABELS = {
  ko: { takeaway: "정리", left: "남은 것", source: "근거" },
  en: { takeaway: "Takeaway", left: "Open", source: "Source" },
};

export const defaultTheme = {
  canvas: { width: 1600, height: 900, columns: 4, gapX: 180, gapY: 180 },
  font: { sans: 2, mono: 8 },
  colors: COLORS,
  tones: TONES,
  neutral: { color: C.slate, soft: C.slateSoft },
  type: {
    title: 44, titleMin: 30,
    subtitle: 21, subtitleMin: 16,
    cardTitle: 22, body: 18, label: 18, chip: 17, step: 15,
    caption: 15, meta: 13, code: 18, takeaway: 19, left: 16,
  },
  layout: {
    margin: 70,
    contentWidth: 1460,
    headerBottom: 236,
    footerBottom: 864,
    footerGap: 16,
    minFooterGap: 10,
  },
  minSize: { body: 15, label: 14, meta: 12, code: 14 },
};

function isPlainObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

export function deepMerge(base, over) {
  if (!isPlainObject(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = isPlainObject(v) && isPlainObject(base?.[k]) ? deepMerge(base[k], v) : v;
  return out;
}

export function mergeTheme(override = {}) {
  return deepMerge(defaultTheme, override);
}
