#!/usr/bin/env node
// Review ledger. A slide counts as reviewed only for the PNG you looked at:
// the ledger stores that PNG's hash, so any later change makes it "changed".
// Usage:
//   node review.mjs [studyDir]                          status
//   node review.mjs [studyDir] --mark 1-5,8 --note "…"  record slides you viewed
//   node review.mjs [studyDir] --audit facts --by "fresh agent" --summary "…" [--verdict ship|fix|…] [--file report.md] [--amend]
//     kinds: facts, pedagogy, writing, consistency, visual, or several ("visual,pedagogy") for one report;
//     --amend replaces the last record of each kind on the current build
//     --file copies the auditor's full report into audits/ so it outlives the session
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadConfig, outPaths, resolveStudyDir } from "./lib/project.mjs";
import { parseSlides } from "./render.mjs";
import { isMain } from "./lib/main.mjs";

function sha(v) {
  return crypto.createHash("sha256").update(v).digest("hex");
}

export async function reviewStatus(dirArg) {
  const dir = resolveStudyDir(dirArg);
  const { config } = await loadConfig(dir);
  const p = outPaths(dir, config);
  const manifest = JSON.parse(fs.readFileSync(p.manifest, "utf8"));
  const ledger = fs.existsSync(p.review) ? JSON.parse(fs.readFileSync(p.review, "utf8")) : { slides: {}, audits: [] };
  const combinedSha = sha(fs.readFileSync(path.join(dir, manifest.combined), "utf8"));
  const report = fs.existsSync(p.renderReport) ? JSON.parse(fs.readFileSync(p.renderReport, "utf8")) : null;
  const staleRender = !report || report.combinedSha256 !== combinedSha;
  const rows = manifest.slides.map((s) => {
    const png = path.join(p.renderDir, `${String(s.number).padStart(2, "0")}-${s.id}.png`);
    if (!fs.existsSync(png)) return { ...s, state: "not rendered" };
    const current = sha(fs.readFileSync(png));
    const seen = ledger.slides[s.id];
    if (!seen) return { ...s, state: "not reviewed", png };
    if (seen.pngSha256 !== current) return { ...s, state: "changed since review", png };
    return { ...s, state: "reviewed", png, note: seen.note };
  });
  return { dir, p, manifest, ledger, rows, staleRender, report, combinedSha };
}

async function mark(dirArg, which, note) {
  const st = await reviewStatus(dirArg);
  if (st.staleRender) throw new Error("render is older than the current build; run render.mjs, look at the PNGs, then mark them");
  const nums = parseSlides(which, st.manifest.slides.length);
  if (!nums?.length) throw new Error("--mark needs slide numbers, e.g. 1-5,8");
  for (const n of nums) {
    const row = st.rows[n - 1];
    if (!row.png) throw new Error(`slide ${n} has no PNG`);
    st.ledger.slides[row.id] = { number: n, pngSha256: sha(fs.readFileSync(row.png)), reviewedAt: new Date().toISOString(), note: note ?? "" };
  }
  fs.writeFileSync(st.p.review, `${JSON.stringify(st.ledger, null, 2)}\n`);
  return nums;
}

export const AUDIT_KINDS = ["facts", "pedagogy", "writing", "consistency", "visual"];
const VERDICTS = ["ship", "fix", "rebuild", "recapture"];

// kindArg may list several kinds ("visual,pedagogy") when one reviewer covered
// them in one report; the report is stored once and every entry points to it.
async function audit(dirArg, kindArg, by, summary, file, verdict, amend) {
  const kinds = String(kindArg).split(",").map((k) => k.trim()).filter(Boolean);
  for (const kind of kinds) {
    if (!AUDIT_KINDS.includes(kind)) throw new Error(`--audit ${kind}: use one of ${AUDIT_KINDS.join(", ")} (a follow-up is the same kind recorded again on the new build)`);
  }
  if (verdict && !VERDICTS.includes(verdict)) throw new Error(`--verdict ${verdict}: use one of ${VERDICTS.join(", ")}`);
  const st = await reviewStatus(dirArg);
  if (amend) {
    for (const kind of kinds) {
      const i = st.ledger.audits.map((a) => a.kind === kind && a.combinedSha256 === st.combinedSha).lastIndexOf(true);
      if (i < 0) throw new Error(`--amend: no ${kind} audit recorded on this build`);
      st.ledger.audits.splice(i, 1);
    }
  }
  const at = new Date().toISOString();
  let stored;
  if (file) {
    if (!fs.existsSync(file)) throw new Error(`--file ${file} does not exist`);
    const dir = path.join(st.dir, "audits");
    fs.mkdirSync(dir, { recursive: true });
    const n = String(fs.readdirSync(dir).length + 1).padStart(2, "0");
    const name = `${n}-${kinds.join("-")}-${at.slice(0, 10)}${path.extname(file) || ".md"}`;
    fs.copyFileSync(file, path.join(dir, name));
    stored = `audits/${name}`;
  }
  const entries = kinds.map((kind) => {
    const entry = { kind, by: by ?? "", summary: summary ?? "", combinedSha256: st.combinedSha, at };
    if (verdict) entry.verdict = verdict;
    if (stored) entry.file = stored;
    return entry;
  });
  st.ledger.audits.push(...entries);
  fs.writeFileSync(st.p.review, `${JSON.stringify(st.ledger, null, 2)}\n`);
  return { kinds, verdict, file: stored };
}

export function formatStatus(st) {
  const out = [];
  const groups = {};
  for (const r of st.rows) (groups[r.state] ??= []).push(r.number);
  if (st.staleRender) out.push("render: stale or missing (run render.mjs)");
  for (const [state, nums] of Object.entries(groups)) out.push(`${state.padEnd(22)} ${nums.length} ${state === "reviewed" ? "" : `→ ${nums.join(", ")}`}`);
  const current = st.ledger.audits.filter((a) => a.combinedSha256 === st.combinedSha);
  out.push(`audits on this build: ${current.length ? current.map((a) => (a.verdict ? `${a.kind} (${a.verdict})` : a.kind)).join(", ") : "none"}${st.ledger.audits.length > current.length ? ` (${st.ledger.audits.length - current.length} on older builds)` : ""}`);
  const readme = path.join(st.dir, "README.md");
  if (fs.existsSync(readme) && fs.readFileSync(readme, "utf8").includes("excalidraw-study:template")) out.push("README.md: still the template (write it in phase 6, then delete the marker line)");
  return out.join("\n");
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const val = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const valued = new Set(["--mark", "--note", "--audit", "--by", "--summary", "--file", "--verdict"]);
  const dirArg = args.find((a, i) => !a.startsWith("--") && !valued.has(args[i - 1]));
  (async () => {
    if (val("--mark")) {
      const nums = await mark(dirArg, val("--mark"), val("--note"));
      console.log(`marked ${nums.length} slide(s) as reviewed: ${nums.join(", ")}`);
    } else if (val("--audit")) {
      const entry = await audit(dirArg, val("--audit"), val("--by"), val("--summary"), val("--file"), val("--verdict"), args.includes("--amend"));
      console.log(`${args.includes("--amend") ? "amended" : "recorded"} ${entry.kinds.join(", ")} audit${entry.verdict ? ` (${entry.verdict})` : ""}${entry.file ? `, report saved to ${entry.file}` : ""}`);
    }
    console.log(formatStatus(await reviewStatus(dirArg)));
  })().catch((e) => {
    console.error(`review failed: ${e.message}`);
    process.exit(1);
  });
}
