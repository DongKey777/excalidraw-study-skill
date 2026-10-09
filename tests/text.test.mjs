import assert from "node:assert/strict";
import test from "node:test";
import { estWidth, fitText, wrapParagraph, wrapText } from "../skills/excalidraw-study/scripts/lib/text.mjs";
import { PROFILES } from "../skills/excalidraw-study/scripts/lib/profiles.mjs";

test("wide glyphs count 1em, others 0.55em", () => {
  assert.equal(estWidth("가나", 20), 40);
  assert.equal(estWidth("ab", 20), 22);
  assert.equal(estWidth("ab", 20, 3), 24);
});

test("wrapping keeps every line within the width", () => {
  const text = "인덱스는 값 순서로 정렬돼 있어 범위 조건을 한 번 내려간 뒤 옆으로 읽는다";
  for (const line of wrapParagraph(text, 18, 300)) assert.ok(estWidth(line, 18) <= 300, line);
});

test("wrapping avoids a one-word last line when it can", () => {
  const lines = wrapParagraph("evidence/labs의 SQL을 로컬 PostgreSQL 18에서 돌리고 Buffers 숫자를 비교한다.", 18, 660);
  assert.equal(lines.length, 2);
  assert.ok(lines[1].includes(" "), lines.join(" | "));
});

test("explicit line breaks are kept", () => {
  assert.equal(wrapText("첫 줄\n둘째 줄", 18, 1000), "첫 줄\n둘째 줄");
});

test("fitText shrinks until the text fits", () => {
  const r = fitText("아주 긴 문장이 들어가는 카드 본문이다 ".repeat(6), { size: 20, min: 14, maxWidth: 400, maxHeight: 150 });
  assert.ok(r.size <= 20 && r.size >= 14);
  assert.equal(typeof r.fits, "boolean");
});

test("Korean polite endings are detected, plain endings are not", () => {
  const f = PROFILES.ko.speechLevel;
  for (const s of ["정리합니다.", "확인했습니다", "값이 아닙니다", "좋아요.", "그렇죠"]) assert.ok(f(s), s);
  for (const s of ["값이 아니다", "정리한다.", "추가 설명이 필요", "잡는다"]) assert.ok(!f(s), s);
});

test("Latin terms inside Korean text are not split across lines", () => {
  const lines = wrapParagraph("페이지는 8kB 단위이고 Seq Scan은 페이지마다 한 번 읽는다", 16, 300);
  assert.ok(lines.every((l) => !l.endsWith("Seq") && !l.startsWith("Scan")), JSON.stringify(lines));
  const en = wrapParagraph("The quick brown fox jumps over the lazy dog again", 16, 200);
  assert.ok(en.length >= 3, JSON.stringify(en));
});

test("wrapping evens out a much shorter last line", () => {
  const lines = wrapParagraph("PR 배포 뒤 당일 성적 집계 쿼리가 재시도로 더 자주 돌던 때의 표본이다", 17, 560);
  const w = lines.map((l) => estWidth(l, 17));
  assert.ok(lines.length < 2 || w[w.length - 1] >= w[w.length - 2] / 3, JSON.stringify(lines));
});
