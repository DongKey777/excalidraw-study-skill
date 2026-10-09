import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildStudy } from "../skills/excalidraw-study/scripts/build.mjs";
import { lintStudy } from "../skills/excalidraw-study/scripts/lint.mjs";
import { baseConfig, copyStudy, example, writeStudy } from "./helpers.mjs";

async function lintOf(files) {
  const dir = writeStudy(files);
  await buildStudy(dir, { quiet: true });
  const { result } = await lintStudy(dir, { write: false });
  return { dir, result, rules: new Set(result.findings.map((f) => f.rule)) };
}

test("the example study has no lint errors with estimated widths", async () => {
  const dir = copyStudy(example);
  await buildStudy(dir, { quiet: true });
  const { result } = await lintStudy(dir, { write: false });
  assert.equal(result.counts.error, 0, JSON.stringify(result.findings.filter((f) => f.severity === "error"), null, 2));
});

test("layout defects are reported", async () => {
  const { rules } = await lintOf({
    "study.config.mjs": baseConfig(),
    "slides/10.mjs": `export default ({ slide }) => [
      slide({ id: "bad", part: "a", step: "상황", title: "레이아웃 문제", subtitle: "부제", takeaway: "정리 문장이다." }, (s) => {
        s.text("이 문장은 상자보다 훨씬 길어서 넘친다", 100, 300, 120, { size: 20 });
        s.text("머리 영역을 침범한다", 100, 200, 400, { size: 18 });
        s.text("하단 바에 붙는다", 100, 790, 400, { size: 20 });
        s.text("겹치는 글자 하나", 700, 400, 400, { size: 20 });
        s.text("겹치는 글자 둘", 720, 405, 400, { size: 20 });
        s.box(900, 500, 200, 60, "", "첫 줄\\n둘째 줄\\n셋째 줄\\n넷째 줄", { wrap: false });
        s.chip("칩 하나", 1200, 300);
        s.chip("칩 둘", 1230, 310);
        s.rect(1500, 600, 200, 50);
      }),
    ];`,
  });
  for (const r of ["text-overflow", "header-zone", "footer-gap", "text-overlap", "card-spill", "shape-overlap", "frame-escape"]) assert.ok(rules.has(r), r);
});

test("a label that runs into a box it does not start in is reported", async () => {
  const { result } = await lintOf({
    "study.config.mjs": baseConfig(),
    "slides/10.mjs": `export default ({ slide }) => [
      slide({ id: "label", part: "a", step: "상황", title: "라벨이 칩을 덮는다", subtitle: "부제", takeaway: "정리 문장이다." }, (s) => {
        s.text("첫 줄\\n둘째 줄\\n셋째 줄", 300, 300, 200, { size: 18, align: "center" });
        s.chip("칩", 400, 355, { anchor: "center", height: 28 });
      }),
    ];`,
  });
  const spills = result.findings.filter((f) => f.rule === "card-spill");
  assert.equal(spills.length, 1, JSON.stringify(result.findings, null, 2));
  assert.match(spills[0].message, /does not start in/);
});

test("the numbers rule counts quantities, not identifiers", async () => {
  const { result } = await lintOf({
    "study.config.mjs": baseConfig(`writing: { maxNumbersPerSlide: 3 },`),
    "slides/10.mjs": `export default ({ slide }) => [
      slide({ id: "ids", part: "a", step: "상황", title: "식별자만 있는 장", subtitle: "9월 16일 PR #65·#66 배포, V12 인덱스", takeaway: "정리 문장이다." }, (s) => {
        s.text("사건 1 · 사건 2·3 · 사건 4~7 · 12장 §3-3 · 9/16 20시 · 10:30 · 3fa9c1e · PostgreSQL 18.4 · EC2", 100, 300, 1400, { size: 18 });
      }),
      slide({ id: "qty", part: "a", step: "분석", title: "양이 많은 장", subtitle: "부제", takeaway: "정리 문장이다." }, (s) => {
        s.text("약 5만 6천 블록 · 440MB · 4초 · 0.04초", 100, 300, 1400, { size: 18 });
      }),
    ];`,
  });
  const hits = result.findings.filter((f) => f.rule === "numbers");
  assert.deepEqual(hits.map((f) => f.slide), [2], JSON.stringify(hits, null, 2));
});

test("short labels repeated across parallel cards are not repeated text", async () => {
  const { result } = await lintOf({
    "study.config.mjs": baseConfig(),
    "slides/10.mjs": `export default ({ slide }) => [
      slide({ id: "cards", part: "a", step: "원리", title: "카드 셋", subtitle: "부제", takeaway: "정리 문장이다." }, (s) => {
        [0, 1, 2].forEach((i) => {
          s.text("하는 일", 100 + i * 400, 300, 300, { size: 16 });
          s.text("같은 문장을 세 번 되풀이한다", 100 + i * 400, 400, 300, { size: 16 });
        });
      }),
    ];`,
  });
  const hits = result.findings.filter((f) => f.rule === "repeated-text");
  assert.equal(hits.length, 1, JSON.stringify(hits, null, 2));
  assert.match(hits[0].message, /되풀이한다/);
});

test("a comma after the conditional -면 is flagged, nouns ending in 면 are not", async () => {
  const { result } = await lintOf({
    "study.config.mjs": baseConfig(),
    "slides/10.mjs": `export default ({ slide }) => [
      slide({ id: "comma", part: "a", step: "상황", title: "쉼표", subtitle: "부제", takeaway: "정리 문장이다." }, (s) => {
        s.text("새 버전을 이어 두면, 인덱스는 그대로다", 100, 300, 800, { size: 20 });
        s.text("화면, 로그, 지표를 함께 본다", 100, 360, 800, { size: 20 });
      }),
    ];`,
  });
  const hits = result.findings.filter((f) => f.rule === "style" && /-면/.test(f.message));
  assert.equal(hits.length, 1, JSON.stringify(result.findings, null, 2));
});

test("centred cards in a row line up their titles; a mixed row is flagged", async () => {
  const { dir, result } = await lintOf({
    "study.config.mjs": baseConfig(),
    "slides/10.mjs": `export default ({ slide }) => [
      slide({ id: "row", part: "a", step: "원리", title: "카드 줄", subtitle: "부제", takeaway: "정리 문장이다." }, (s) => {
        s.card({ x: 70, y: 300, w: 450, h: 220 }, { title: "짧은 카드", body: "한 줄" });
        s.card({ x: 560, y: 300, w: 450, h: 220 }, { title: "긴 카드", body: "첫 줄\\n둘째 줄\\n셋째 줄\\n넷째 줄" });
        s.card({ x: 1050, y: 300, w: 450, h: 220 }, { title: "가운데 카드", body: "두 줄\\n이다" });
        s.card({ x: 70, y: 560, w: 450, h: 180 }, { title: "위 정렬", body: "한 줄", valign: "top" });
        s.card({ x: 560, y: 560, w: 450, h: 180 }, { title: "가운데 정렬", body: "첫 줄\\n둘째 줄" });
      }),
    ];`,
  });
  const scene = JSON.parse(fs.readFileSync(path.join(dir, "build", "slides", "01-row.excalidraw"), "utf8"));
  const titles = scene.elements.filter((e) => e.customData?.study?.role === "card.title" && e.y < 520);
  assert.equal(new Set(titles.map((t) => Math.round(t.y))).size, 1, JSON.stringify(titles.map((t) => t.y)));
  assert.equal(result.findings.filter((f) => f.rule === "card-align").length, 1, JSON.stringify(result.findings, null, 2));
});

test("writing rules are reported", async () => {
  const { rules } = await lintOf({
    "study.config.mjs": baseConfig(`writing: { banned: ["청구서"], replace: { "표를 조회": "테이블을 조회" } },`),
    "slides/10.mjs": `export default ({ slide }) => [
      slide({ id: "w", part: "a", step: "상황", title: "제목에 마침표.", subtitle: "요청이 오고, 워커가 처리한다", takeaway: "이 덱은 정리합니다." }, (s) => {
        s.text("원인 — 잠금 대기", 100, 300, 800, { size: 20 });
        s.text("청구서가 날아온다", 100, 360, 800, { size: 20 });
        s.text("주문 표를 조회한다", 100, 420, 800, { size: 20 });
      }),
    ];`,
  });
  for (const r of ["title-period", "connective-comma", "banned", "speech-level", "dash", "replace"]) assert.ok(rules.has(r), r);
});

test("pedagogy and evidence rules are reported", async () => {
  const { rules } = await lintOf({
    "study.config.mjs": baseConfig(`glossary: { "HOT": "hot" },`),
    "evidence/claims.md": "| id | 주장 | 상태 |\n|---|---|---|\n| C1 | 확인한 주장 | 확인 |\n| C2 | 아직 모름 | 미확인 |\n",
    "slides/10.mjs": `export default ({ slide }) => [
      slide({ id: "early", part: "a", step: "상황", title: "HOT가 먼저 나온다", subtitle: "부제", takeaway: "정리.", claims: ["C1", "C2", "C9"] }),
      slide({ id: "hot", part: "a", step: "원리", title: "HOT 설명", subtitle: "부제", takeaway: "정리." }),
      slide({ id: "nothing", part: "a", step: "해결", title: "정리 없는 장", subtitle: "부제" }),
    ];`,
  });
  for (const r of ["glossary-order", "claims", "spec"]) assert.ok(rules.has(r), r);
});

test("a single-slide file that drifts from the combined file is reported", async () => {
  const dir = copyStudy(example);
  const { manifest } = await buildStudy(dir, { quiet: true });
  const file = path.join(dir, manifest.slides[1].file);
  const scene = JSON.parse(fs.readFileSync(file, "utf8"));
  scene.elements[3].x += 10;
  fs.writeFileSync(file, JSON.stringify(scene));
  const { result } = await lintStudy(dir, { write: false });
  assert.ok(result.findings.some((f) => f.rule === "frames"));
});

test("ignores need to be recorded and are listed separately", async () => {
  const { result } = await lintOf({
    "study.config.mjs": baseConfig(),
    "slides/10.mjs": `export default ({ slide }) => [
      slide({ id: "i", part: "a", step: "상황", title: "무시", subtitle: "부제", takeaway: "정리 문장이다." }, (s) => {
        s.text("원인 — 잠금 대기", 100, 300, 800, { size: 20, lint: { ignore: ["dash"], reason: "test" } });
      }),
    ];`,
  });
  assert.ok(!result.findings.some((f) => f.rule === "dash"));
  assert.ok(result.ignored.some((f) => f.rule === "dash" && f.reason === "test"));
});

test("newer layout and code rules are reported", async () => {
  const { rules } = await lintOf({
    "study.config.mjs": baseConfig(),
    "slides/10.mjs": `export default ({ slide }) => [
      slide({ id: "n", part: "a", step: "상황", title: "새 규칙", subtitle: "부제", takeaway: "정리 문장이다." }, (s) => {
        s.box(100, 260, 500, 300, "큰 상자", "한 줄뿐이다", { valign: "top" });
        s.marker(1, 800, 300);
        s.arrow(700, 317, 950, 317);
        s.text("가나다라마바사아자차카타파하 가나다라마바사아자차카타파하 끝", 100, 600, 560, { size: 20 , wrap: false });
        s.text("가나다라마바사아자차카타파하가나다라마바사\\n끝", 700, 600, 480, { size: 20 });
        s.text("WHERE a >= 1", 1000, 400, 400, { size: 18, family: 3 });
      }),
    ];`,
  });
  for (const r of ["sparse-box", "arrow-through-shape", "orphan", "code-ligature"]) assert.ok(rules.has(r), r);
});

test("an unfilled plan and a two-line takeaway are flagged", async () => {
  const { rules } = await lintOf({
    "study.config.mjs": baseConfig(),
    "plan.md": "<!-- excalidraw-study:template delete this line once the file is filled in -->\n# plan\n",
    "slides/10.mjs": `export default ({ slide }) => [
      slide({ id: "long", part: "a", step: "원리", title: "긴 정리", subtitle: "부제", takeaway: "정리 문장이 너무 길어서 한 줄에 들어가지 않으면 두 줄로 넘어가는데 그러면 독자가 가져갈 한 문장이 흐려지므로 이 규칙이 경고를 낸다고 기대한다. 그리고 한 문장을 더 붙여서 확실히 넘친다." }),
    ];`,
  });
  assert.ok(rules.has("unfilled"));
  assert.ok(rules.has("takeaway-length"));
});

test("a connecting line through a chip and a note running into a table are flagged", async () => {
  const { result } = await lintOf({
    "study.config.mjs": baseConfig(),
    "slides/10.mjs": `export default ({ slide }) => [
      slide({ id: "graph", part: "a", step: "원리", title: "그래프", subtitle: "부제", takeaway: "정리 문장이다." }, (s) => {
        s.ellipse(100, 300, 40, 40);
        s.ellipse(500, 300, 40, 40);
        s.chip("main", 300, 303, { height: 34 });
        s.line(140, 320, 500, 320);
        s.line(200, 330, 200, 360);
        const t = s.table({ x: 700, y: 300, w: 600, h: 200 }, [["a", "b"], ["c", "d"], ["e", "f"]]);
        s.text("표 아래에 둔다고 생각한 설명", 720, t.y + t.h - 20, 500, { size: 16 });
      }),
    ];`,
  });
  const rules = result.findings.map((f) => f.rule);
  assert.ok(rules.includes("arrow-through-shape"), JSON.stringify(result.findings, null, 2));
  assert.ok(result.findings.some((f) => f.rule === "card-spill" && /table/.test(f.message)), JSON.stringify(result.findings, null, 2));
});
