import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildStudy } from "../skills/excalidraw-study/scripts/build.mjs";
import { baseConfig, copyStudy, example, writeStudy } from "./helpers.mjs";

test("the same slides build byte-identical files", async () => {
  const dir = copyStudy(example);
  const first = await buildStudy(dir, { quiet: true });
  const a = fs.readFileSync(first.paths.combined, "utf8");
  const aSlides = fs.readdirSync(first.paths.slidesDir).map((f) => fs.readFileSync(path.join(first.paths.slidesDir, f), "utf8"));
  const second = await buildStudy(dir, { quiet: true });
  assert.equal(fs.readFileSync(second.paths.combined, "utf8"), a);
  assert.deepEqual(fs.readdirSync(second.paths.slidesDir).map((f) => fs.readFileSync(path.join(second.paths.slidesDir, f), "utf8")), aSlides);
});

test("manifest uses relative paths and one frame per slide", async () => {
  const dir = copyStudy(example);
  const { manifest, paths } = await buildStudy(dir, { quiet: true });
  const scene = JSON.parse(fs.readFileSync(paths.combined, "utf8"));
  assert.equal(scene.elements.filter((e) => e.type === "frame").length, manifest.count);
  for (const s of manifest.slides) assert.ok(!path.isAbsolute(s.file), s.file);
});

test("{{#id}} becomes the slide number and unknown ids fail", async () => {
  const good = writeStudy({
    "study.config.mjs": baseConfig(),
    "slides/10.mjs": `export default ({ slide }) => [
      slide({ id: "one", part: "a", title: "첫 장", takeaway: "정리.", subtitle: "{{#two}}장에서 이어진다" }),
      slide({ id: "two", part: "a", title: "둘째 장", takeaway: "정리." }),
    ];`,
  });
  const { paths } = await buildStudy(good, { quiet: true });
  const scene = JSON.parse(fs.readFileSync(paths.combined, "utf8"));
  assert.ok(scene.elements.some((e) => e.type === "text" && e.text === "2장에서 이어진다"));

  const bad = writeStudy({
    "study.config.mjs": baseConfig(),
    "slides/10.mjs": `export default ({ slide }) => [slide({ id: "one", part: "a", title: "{{#nope}}", takeaway: "정리." })];`,
  });
  await assert.rejects(buildStudy(bad, { quiet: true }), /unknown slide reference/);
});

test("duplicate ids and unknown parts are rejected before drawing", async () => {
  const dir = writeStudy({
    "study.config.mjs": baseConfig(),
    "slides/10.mjs": `export default ({ slide }) => [
      slide({ id: "same", part: "a", title: "하나", takeaway: "정리." }),
      slide({ id: "same", part: "zzz", title: "둘", takeaway: "정리." }),
    ];`,
  });
  await assert.rejects(buildStudy(dir, { quiet: true }), (e) => /duplicate id/.test(e.message) && /unknown part/.test(e.message));
});

test("consecutive highlighted code lines share one mark", async () => {
  const dir = writeStudy({
    "study.config.mjs": baseConfig(),
    "slides/10.mjs": `export default ({ slide }) => [
      slide({ id: "code", part: "a", step: "분석", title: "코드", subtitle: "부제", takeaway: "정리 문장이다." }, (s) => {
        s.code("a\\nb\\nc\\nd\\ne", 70, 300, 600, 200, { highlight: [3, 1, 2, 0] });
      }),
    ];`,
  });
  const { paths } = await buildStudy(dir, { quiet: true });
  const scene = JSON.parse(fs.readFileSync(paths.combined, "utf8"));
  const marks = scene.elements.filter((e) => e.customData?.study?.role === "code.mark");
  assert.equal(marks.length, 1);
});

test("scripts run when called through a symlink", async () => {
  const { execFileSync } = await import("node:child_process");
  const os = await import("node:os");
  const link = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "es-link-")), "skill");
  fs.symlinkSync(path.resolve(example, "..", "..", "skills", "excalidraw-study"), link);
  const out = execFileSync(process.execPath, [path.join(link, "scripts", "lint.mjs"), "--rules"], { encoding: "utf8" });
  assert.match(out, /schema/);
});

test("graph draws nodes and edges and returns node rects", async () => {
  const dir = writeStudy({
    "study.config.mjs": baseConfig(),
    "slides/10.mjs": `export default ({ slide }) => [
      slide({ id: "g", part: "a", step: "원리", title: "그래프", subtitle: "부제", takeaway: "정리 문장이다." }, (s) => {
        const g = s.graph([{ id: "A", x: 200, y: 400, label: "A" }, { id: "B", x: 400, y: 500, label: "B", shape: "box" }], [{ from: "A", to: "B", route: "hv", label: "rebase" }]);
        s.text(String(Math.round(g.nodes.B.x)), 600, 400, 100, { size: 16 });
      }),
    ];`,
  });
  const { paths } = await buildStudy(dir, { quiet: true });
  const els = JSON.parse(fs.readFileSync(paths.combined, "utf8")).elements;
  assert.equal(els.filter((e) => e.customData?.study?.role === "graph.node").length, 2);
  const edge = els.find((e) => e.customData?.study?.role === "graph.edge");
  assert.equal(edge.points.length, 3);
  assert.ok(els.some((e) => e.type === "text" && e.text === "340"));
  const bad = writeStudy({
    "study.config.mjs": baseConfig(),
    "slides/10.mjs": `export default ({ slide }) => [slide({ id: "g", part: "a", title: "t", subtitle: "s", takeaway: "정리." }, (s) => { s.graph([{ id: "A", x: 1, y: 1 }], [{ from: "A", to: "Z" }]); })];`,
  });
  await assert.rejects(buildStudy(bad, { quiet: true }), /unknown node/);
});
