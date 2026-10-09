import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { buildStudy } from "../skills/excalidraw-study/scripts/build.mjs";
import { reviewStatus } from "../skills/excalidraw-study/scripts/review.mjs";
import { copyStudy, example, scripts } from "./helpers.mjs";

test("review marks bind to the PNG hash", async () => {
  const dir = copyStudy(example);
  const { manifest, paths } = await buildStudy(dir, { quiet: true });
  fs.mkdirSync(paths.renderDir, { recursive: true });
  const combinedSha = crypto.createHash("sha256").update(fs.readFileSync(paths.combined, "utf8")).digest("hex");
  const pngs = manifest.slides.map((s) => {
    const f = path.join(paths.renderDir, `${String(s.number).padStart(2, "0")}-${s.id}.png`);
    fs.writeFileSync(f, `fake png ${s.id}`);
    return f;
  });
  fs.writeFileSync(paths.renderReport, JSON.stringify({ combinedSha256: combinedSha, slides: [] }));
  execFileSync(process.execPath, [path.join(scripts, "review.mjs"), dir, "--mark", "1-2"], { stdio: "pipe" });
  let st = await reviewStatus(dir);
  assert.equal(st.rows[0].state, "reviewed");
  assert.equal(st.rows[2].state, "not reviewed");
  fs.writeFileSync(pngs[0], "changed");
  st = await reviewStatus(dir);
  assert.equal(st.rows[0].state, "changed since review");
});

test("an audit with --file keeps the full report inside the study", async () => {
  const dir = copyStudy(example);
  await buildStudy(dir, { quiet: true });
  const report = path.join(dir, "..", `report-${path.basename(dir)}.md`);
  fs.writeFileSync(report, "# facts\n\nslide 3: value differs\n");
  const out = execFileSync(process.execPath, [path.join(scripts, "review.mjs"), dir, "--audit", "facts", "--by", "test", "--summary", "1 finding", "--file", report], { encoding: "utf8" });
  assert.match(out, /report saved to audits\//);
  const ledger = JSON.parse(fs.readFileSync(path.join(dir, "review.json"), "utf8"));
  const entry = ledger.audits.at(-1);
  assert.equal(fs.readFileSync(path.join(dir, entry.file), "utf8"), fs.readFileSync(report, "utf8"));
});

test("claims.mjs --apply replaces rows by id and inserts new ones next to their siblings", async () => {
  const dir = copyStudy(example);
  const rows = path.join(dir, "rows.md");
  fs.writeFileSync(rows, "| C3 | 바뀐 주장 | 2 | 실험 | 2026-10-08 | 실측 |\n| C3a | 무시되지 않는다 | 1 | 실험 | 2026-10-08 | 실측 |\n");
  execFileSync(process.execPath, [path.join(scripts, "claims.mjs"), dir, "--apply", rows], { stdio: "pipe" });
  const lines = fs.readFileSync(path.join(dir, "evidence", "claims.md"), "utf8").split("\n");
  const at = (id) => lines.findIndex((l) => l.startsWith(`| ${id} |`));
  assert.match(lines[at("C3")], /바뀐 주장/);
  assert.ok(at("C3a") > 0);
  assert.equal(lines.filter((l) => l.startsWith("| C3 |")).length, 1);
  fs.writeFileSync(rows, "| C4 | 열이 모자라다 |\n");
  assert.throws(() => execFileSync(process.execPath, [path.join(scripts, "claims.mjs"), dir, "--apply", rows], { stdio: "pipe" }));
});
