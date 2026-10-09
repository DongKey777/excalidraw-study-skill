#!/usr/bin/env node
// Render every frame with Excalidraw's own exporter in a headless browser,
// measure each text line as the browser lays it out, write contact sheets,
// then re-run the linter with the measured widths.
// Usage: node render.mjs [studyDir] [--slides 3,5-7] [--no-sheet] [--preview] [--scale 1]
// Output: build/render/NN-<id>.png, contact-NN.png, measure.json, render-report.json
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { formatReport, loadLintContext, runLint } from "./lib/lint.mjs";
import { frameToSvg } from "./lib/preview-svg.mjs";
import { loadConfig, outPaths, resolveStudyDir } from "./lib/project.mjs";
import { ensureRuntime, launchBrowser, RUNTIME, runtimeDir, runtimeRequire } from "./lib/runtime.mjs";
import { isMain } from "./lib/main.mjs";
import { DEFAULT_METRICS, fitMetrics } from "./lib/text.mjs";

const FAMILY_NAMES = { 1: "Virgil", 2: "Helvetica", 3: "Cascadia", 5: "Excalifont", 6: "Nunito", 7: "Lilita One", 8: "Comic Shanns", 9: "Liberation Sans" };

function sha(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function parseSlides(arg, count) {
  if (!arg) return null;
  const set = new Set();
  for (const part of arg.split(",")) {
    const [a, b] = part.split("-").map((n) => Number(n.trim()));
    if (!Number.isInteger(a)) continue;
    for (let n = a; n <= (Number.isInteger(b) ? b : a); n += 1) if (n >= 1 && n <= count) set.add(n);
  }
  return [...set].sort((x, y) => x - y);
}

function serve(root, extra = {}) {
  const types = { ".js": "text/javascript", ".html": "text/html", ".woff2": "font/woff2", ".png": "image/png", ".json": "application/json" };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    if (extra[url]) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(extra[url]);
    }
    const [mount, base] = url.startsWith("/png/") ? ["/png/", extra.pngDir] : ["/", root];
    const file = path.join(base, url.slice(mount.length));
    if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port })));
}

async function renderWithBrowser({ scene, entries, pngDir, scale, log }) {
  await ensureRuntime({ log });
  const dir = runtimeDir();
  const extra = { pngDir };
  const { server, port } = await serve(dir, extra);
  extra["/page.html"] = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#fff}#out svg{display:block}</style></head>
<body><div id="out"></div><script>window.EXCALIDRAW_ASSET_PATH="http://127.0.0.1:${port}/";</script><script src="/excalidraw-export.js"></script></body></html>`;
  const { browser, how } = await launchBrowser();
  const version = browser.version();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: scale });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 300)));
  await page.goto(`http://127.0.0.1:${port}/page.html`);
  await page.waitForFunction(() => typeof window.exportToSvg === "function", null, { timeout: 30000 });

  const widths = {};
  const results = [];
  let fallbackTexts = 0;
  for (const entry of entries) {
    const els = scene.elements.filter((e) => e.id === entry.frameId || e.frameId === entry.frameId);
    const out = await page.evaluate(async ({ els, frameId, names }) => {
      const frame = els.find((e) => e.id === frameId);
      const svg = await window.exportToSvg({
        elements: els,
        appState: { exportBackground: true, viewBackgroundColor: "#ffffff", exportWithDarkMode: false, exportScale: 1 },
        files: {},
        exportingFrame: frame,
      });
      const host = document.getElementById("out");
      host.innerHTML = "";
      host.appendChild(svg);
      await document.fonts.ready;
      const nodes = [...svg.querySelectorAll("text")];
      const texts = els.filter((e) => e.type === "text" && !e.isDeleted);
      const ctx = document.createElement("canvas").getContext("2d");
      const widths = {};
      let k = 0;
      let fallback = 0;
      for (const t of texts) {
        const lines = t.text.split("\n");
        const start = k;
        const w = [];
        let ok = true;
        for (const line of lines) {
          const node = nodes[k];
          if (node && node.textContent === line) {
            w.push(line ? node.getComputedTextLength() : 0);
            k += 1;
          } else if (line === "") {
            w.push(0);
          } else {
            ok = false;
            break;
          }
        }
        if (!ok) {
          k = start;
          fallback += 1;
          ctx.font = `${t.fontSize}px ${names[t.fontFamily] ?? "Helvetica"}, Segoe UI Emoji`;
          widths[t.id] = lines.map((l) => ctx.measureText(l).width);
        } else {
          widths[t.id] = w;
        }
      }
      const r = svg.getBoundingClientRect();
      return { widths, fallback, w: r.width, h: r.height };
    }, { els, frameId: entry.frameId, names: FAMILY_NAMES });
    Object.assign(widths, out.widths);
    fallbackTexts += out.fallback;
    const file = path.join(pngDir, `${String(entry.number).padStart(2, "0")}-${entry.id}.png`);
    await page.locator("#out svg").screenshot({ path: file });
    const buf = fs.readFileSync(file);
    results.push({ number: entry.number, id: entry.id, png: file, sha256: sha(buf), size: [Math.round(out.w * scale), Math.round(out.h * scale)] });
    log(`  ${String(entry.number).padStart(2, "0")} ${entry.id}`);
  }
  return { browser, page, server, port, how, version, widths, results, fallbackTexts, pageErrors, extra };
}

async function contactSheets({ page, port, entries, renderDir, extra, perSheet = 20 }) {
  const sheets = [];
  for (let i = 0; i < entries.length; i += perSheet) {
    const chunk = entries.slice(i, i + perSheet);
    const n = sheets.length + 1;
    const cells = chunk.map((e) => {
      const f = `${String(e.number).padStart(2, "0")}-${e.id}.png`;
      return `<figure><img src="/png/${encodeURIComponent(f)}"><figcaption>${e.number} · ${e.id}</figcaption></figure>`;
    }).join("");
    extra[`/sheet-${n}.html`] = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:#E2E8F0;font:16px Helvetica,Arial,sans-serif;width:1712px}
main{display:grid;grid-template-columns:repeat(4,404px);gap:24px}
figure{margin:0}img{width:404px;height:227px;display:block;background:#fff;box-shadow:0 0 0 1px #94A3B8}
figcaption{margin-top:6px;color:#334155}</style></head><body><main>${cells}</main></body></html>`;
    await page.setViewportSize({ width: 1760, height: 900 });
    await page.goto(`http://127.0.0.1:${port}/sheet-${n}.html`);
    await page.waitForFunction(() => [...document.images].every((im) => im.complete && im.naturalWidth > 0), null, { timeout: 30000 });
    const file = path.join(renderDir, `contact-${String(n).padStart(2, "0")}.png`);
    await page.screenshot({ path: file, fullPage: true });
    sheets.push({ file, slides: chunk.map((e) => e.number) });
  }
  return sheets;
}

async function renderPreview({ scene, entries, pngDir, log }) {
  let Resvg = null;
  try {
    await ensureRuntime({ log });
    ({ Resvg } = runtimeRequire("@resvg/resvg-js"));
  } catch (e) {
    log(`resvg unavailable (${e.message.split("\n")[0]}); writing SVG only`);
  }
  const results = [];
  for (const entry of entries) {
    const frame = scene.elements.find((e) => e.id === entry.frameId);
    const els = scene.elements.filter((e) => e.frameId === entry.frameId);
    const svg = frameToSvg(frame, els);
    const stem = path.join(pngDir, `${String(entry.number).padStart(2, "0")}-${entry.id}`);
    if (Resvg) {
      const png = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: "Apple SD Gothic Neo" }, fitTo: { mode: "width", value: 1600 } }).render().asPng();
      fs.writeFileSync(`${stem}.png`, png);
      results.push({ number: entry.number, id: entry.id, png: `${stem}.png`, sha256: sha(png) });
    } else {
      fs.writeFileSync(`${stem}.svg`, svg);
      results.push({ number: entry.number, id: entry.id, svg: `${stem}.svg` });
    }
  }
  return results;
}

export async function renderStudy(dirArg, opts = {}) {
  const log = opts.log ?? ((m) => console.error(m));
  const dir = resolveStudyDir(dirArg);
  const { config } = await loadConfig(dir);
  const p = outPaths(dir, config);
  if (!fs.existsSync(p.manifest)) throw new Error("build/manifest.json not found. Run build.mjs first.");
  const manifest = JSON.parse(fs.readFileSync(p.manifest, "utf8"));
  const raw = fs.readFileSync(path.join(dir, manifest.combined), "utf8");
  const combinedSha256 = sha(raw);
  const scene = JSON.parse(raw);
  const pick = parseSlides(opts.slides, manifest.slides.length);
  const entries = pick ? manifest.slides.filter((s) => pick.includes(s.number)) : manifest.slides;
  fs.mkdirSync(p.renderDir, { recursive: true });
  if (!pick) {
    const keep = new Set(manifest.slides.map((s) => `${String(s.number).padStart(2, "0")}-${s.id}`));
    for (const f of fs.readdirSync(p.renderDir)) {
      const stem = f.replace(/\.(png|svg)$/, "");
      if (/\.(png|svg)$/.test(f) && !f.startsWith("contact-") && !keep.has(stem)) fs.unlinkSync(path.join(p.renderDir, f));
    }
  }

  let report;
  let metricsChanged = false;
  let mode = opts.preview ? "preview" : "excalidraw";
  let rendered;
  if (mode === "excalidraw") {
    try {
      rendered = await renderWithBrowser({ scene, entries, pngDir: p.renderDir, scale: opts.scale ?? 1, log });
    } catch (e) {
      if (e.code !== "NO_BROWSER") throw e;
      log(e.message);
      log("falling back to the approximate preview renderer");
      mode = "preview";
    }
  }
  if (mode === "excalidraw") {
    const { browser, page, server, port, how, version, widths, results, fallbackTexts, pageErrors, extra } = rendered;
    let sheets = [];
    if (opts.sheet !== false) sheets = await contactSheets({ page, port, entries: manifest.slides.filter((s) => fs.existsSync(path.join(p.renderDir, `${String(s.number).padStart(2, "0")}-${s.id}.png`))), renderDir: p.renderDir, extra });
    await browser.close();
    server.close();
    let prior = {};
    if (pick && fs.existsSync(p.measure)) {
      const m = JSON.parse(fs.readFileSync(p.measure, "utf8"));
      if (m.combinedSha256 === combinedSha256) prior = m.widths;
    }
    const renderer = `excalidraw@${RUNTIME.excalidraw} exportToSvg in ${how} ${version}`;
    fs.writeFileSync(p.measure, `${JSON.stringify({ combinedSha256, renderer, widths: { ...prior, ...widths } }, null, 2)}\n`);
    metricsChanged = calibrate({ scene, widths: { ...prior, ...widths }, p, renderer, used: manifest.metrics });
    report = { mode, renderer, combinedSha256, textsMeasuredByCanvas: fallbackTexts, pageErrors, slides: results.map((r) => ({ ...r, png: path.relative(dir, r.png) })), sheets: sheets.map((s) => ({ ...s, file: path.relative(dir, s.file) })) };
  } else {
    const results = await renderPreview({ scene, entries, pngDir: p.renderDir, log });
    report = { mode, renderer: "approximate SVG preview (not Excalidraw); text widths are not measured", combinedSha256, slides: results.map((r) => ({ ...r, png: r.png && path.relative(dir, r.png), svg: r.svg && path.relative(dir, r.svg) })), sheets: [] };
  }
  if (pick && fs.existsSync(p.renderReport)) {
    const old = JSON.parse(fs.readFileSync(p.renderReport, "utf8"));
    if (old.combinedSha256 === combinedSha256) {
      const merged = new Map(old.slides.map((s) => [s.id, s]));
      for (const s of report.slides) merged.set(s.id, s);
      report.slides = [...merged.values()].sort((a, b) => a.number - b.number);
    }
  }
  fs.writeFileSync(p.renderReport, `${JSON.stringify(report, null, 2)}\n`);

  const ctx = loadLintContext(dir, config);
  const lint = runLint(ctx);
  fs.writeFileSync(p.lint, `${JSON.stringify(lint, null, 2)}\n`);
  return { report, lint, manifest, paths: p, metricsChanged };
}

// Fit text width factors to what Excalidraw laid out and save them for the
// next build (build/metrics.json). Returns true when they moved enough to
// change wrapping.
function calibrate({ scene, widths, p, renderer, used }) {
  const samples = [];
  for (const el of scene.elements) {
    if (el.type !== "text" || !widths[el.id]) continue;
    el.text.split("\n").forEach((line, i) => {
      const w = widths[el.id][i];
      if (line && typeof w === "number" && w > 0) samples.push({ text: line, size: el.fontSize, family: el.fontFamily, width: w });
    });
  }
  const metrics = fitMetrics(samples);
  fs.writeFileSync(p.metrics, `${JSON.stringify({ renderer, samples: samples.length, metrics }, null, 2)}\n`);
  const before = used ?? DEFAULT_METRICS;
  return Object.keys(metrics).some((k) => Math.abs(metrics[k] - (before[k] ?? metrics[k])) > 0.01);
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const val = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const dirArg = args.find((a, i) => !a.startsWith("--") && !["--slides", "--scale"].includes(args[i - 1]));
  renderStudy(dirArg, { slides: val("--slides"), sheet: !args.includes("--no-sheet"), preview: args.includes("--preview"), scale: Number(val("--scale") ?? 1) })
    .then(({ report, lint, manifest }) => {
      console.log(`rendered ${report.slides.length} slide(s) with ${report.renderer}`);
      for (const s of report.sheets) console.log(`  contact sheet ${s.file} (slides ${s.slides[0]}-${s.slides[s.slides.length - 1]})`);
      if (report.pageErrors?.length) console.log(`  page errors: ${report.pageErrors.join(" | ")}`);
      console.log(formatReport(lint, { manifest }));
      process.exitCode = lint.counts.error > 0 ? 2 : 0;
    })
    .catch((e) => {
      console.error(`render failed: ${e.stack ?? e.message}`);
      process.exit(1);
    });
}
