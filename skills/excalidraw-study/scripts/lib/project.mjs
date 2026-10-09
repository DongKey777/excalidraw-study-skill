// Loads a study project: study.config.mjs plus slides/*.mjs in file-name order.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as kit from "./kit.mjs";
import { LABELS, STEP_PRESETS, mergeTheme } from "./theme.mjs";
import { UPDATED } from "./scene.mjs";

export const SLIDE_ID = /^[a-z0-9][a-z0-9-]*$/;

export function resolveStudyDir(arg) {
  const dir = path.resolve(arg ?? process.cwd());
  if (!fs.existsSync(path.join(dir, "study.config.mjs"))) {
    throw new Error(`study.config.mjs not found in ${dir}. Run scripts/new.mjs first or pass the study folder.`);
  }
  return dir;
}

export async function loadConfig(dir) {
  const url = `${pathToFileURL(path.join(dir, "study.config.mjs")).href}?t=${Date.now()}`;
  const mod = await import(url);
  const raw = mod.default ?? mod.config;
  if (!raw || typeof raw !== "object") throw new Error("study.config.mjs must export a default object");
  const config = { lang: "ko", parts: {}, writing: {}, lint: {}, glossary: {}, ...raw };
  config.name = config.name ?? path.basename(dir);
  config.output = { dir: "build", ...(raw.output ?? {}) };
  const theme = mergeTheme(config.theme ?? {});
  const steps = Array.isArray(config.steps) ? config.steps : STEP_PRESETS[config.steps ?? (config.lang === "en" ? "case-first-en" : "case-first-ko")];
  if (!steps) throw new Error(`unknown steps preset: ${config.steps}`);
  const labels = { ...(LABELS[config.lang] ?? LABELS.en), ...(config.labels ?? {}) };
  return { config, theme, steps, labels };
}

export async function loadSlides(dir, theme = mergeTheme()) {
  const slidesDir = path.join(dir, "slides");
  if (!fs.existsSync(slidesDir)) throw new Error(`slides/ folder not found in ${dir}`);
  const files = fs.readdirSync(slidesDir).filter((f) => f.endsWith(".mjs") && !f.startsWith("_")).sort();
  const api = { ...kit, COLORS: theme.colors, TONES: theme.tones, C: theme.colors, TONE: theme.tones, theme };
  const defs = [];
  for (const file of files) {
    const url = `${pathToFileURL(path.join(slidesDir, file)).href}?t=${Date.now()}`;
    let mod;
    try {
      mod = await import(url);
    } catch (e) {
      throw new Error(`slides/${file}: ${e.message}`);
    }
    const exported = typeof mod.default === "function" ? mod.default(api) : mod.default;
    const list = Array.isArray(exported) ? exported : [exported];
    for (const d of list) {
      if (!d || !d.spec) throw new Error(`slides/${file}: default export must be slide(spec, draw), an array of them, or (kit) => ...`);
      defs.push({ ...d, file });
    }
  }
  return defs;
}

export function validateSpecs(defs, { config, steps }) {
  const errors = [];
  const seen = new Map();
  defs.forEach(({ spec, file }) => {
    const where = `slides/${file} ${spec.id ?? "(no id)"}`;
    if (!spec.id || !SLIDE_ID.test(spec.id)) errors.push(`${where}: id must match ${SLIDE_ID}`);
    else if (seen.has(spec.id)) errors.push(`${where}: duplicate id (also in slides/${seen.get(spec.id)})`);
    else seen.set(spec.id, file);
    if (!spec.title) errors.push(`${where}: title is required`);
    if (spec.part && !config.parts[spec.part]) errors.push(`${where}: unknown part "${spec.part}" (define it in study.config.mjs parts)`);
    if (spec.step && !steps.some((s) => s.name === spec.step)) errors.push(`${where}: unknown step "${spec.step}"`);
  });
  return errors;
}

export function buildContext(loaded, defs) {
  const refs = new Map(defs.map((d, i) => [d.spec.id, i + 1]));
  return { ...loaded, parts: loaded.config.parts, refs, updated: loaded.config.updated ?? UPDATED };
}

export function outPaths(dir, config) {
  const out = path.join(dir, config.output.dir);
  return {
    out,
    combined: path.join(dir, `${config.name}.excalidraw`),
    slidesDir: path.join(out, "slides"),
    manifest: path.join(out, "manifest.json"),
    outline: path.join(out, "outline.md"),
    lint: path.join(out, "lint.json"),
    renderDir: path.join(out, "render"),
    measure: path.join(out, "render", "measure.json"),
    metrics: path.join(out, "metrics.json"),
    renderReport: path.join(out, "render", "render-report.json"),
    review: path.join(dir, "review.json"),
  };
}

// Text width factors for this study: config.metrics (fixed values, or
// { calibrate: false } to keep the generous defaults) wins over the values
// render.mjs fitted from the last render (build/metrics.json).
export function studyMetrics(config, paths) {
  const cfg = config.metrics ?? {};
  if (cfg.calibrate === false) return { ...cfg };
  let fitted = {};
  if (fs.existsSync(paths.metrics)) {
    try {
      fitted = JSON.parse(fs.readFileSync(paths.metrics, "utf8")).metrics ?? {};
    } catch {
      fitted = {};
    }
  }
  return { ...fitted, ...cfg };
}
