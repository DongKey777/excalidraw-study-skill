#!/usr/bin/env node
// Scaffold a study folder.
// Usage: node new.mjs <dir> [--name my-study] [--title "..."] [--lang ko|en] [--flow case|concept|comparison|tour] [--steps preset]
// --flow picks the step chips and a starting set of parts (references/brief-and-structure.md);
// --steps names a preset directly (case-first-ko, concept-first-en, comparison-ko, none, ...).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const templates = path.resolve(here, "..", "assets", "template");

// Parts and the first sample slide per flow. Steps come from the preset.
const FLOWS = {
  case: {
    preset: { ko: "case-first-ko", en: "case-first-en" },
    parts: { ko: [["c1", "사건 1", "첫 번째 사건"]], en: [["c1", "Case 1", "First case"]] },
    sample: { ko: ["c1-situation", "c1", "상황"], en: ["c1-situation", "c1", "Situation"] },
  },
  concept: {
    preset: { ko: "concept-first-ko", en: "concept-first-en" },
    parts: { ko: [["p1", "1부", "첫 번째 개념"]], en: [["p1", "Part 1", "First concept"]] },
    sample: { ko: ["p1-question", "p1", "질문"], en: ["p1-question", "p1", "Question"] },
  },
  comparison: {
    preset: { ko: "comparison-ko", en: "comparison-en" },
    parts: { ko: [["a1", "비교 1", "첫 번째 기준"]], en: [["a1", "Aspect 1", "First criterion"]] },
    sample: { ko: ["a1-question", "a1", "질문"], en: ["a1-question", "a1", "Question"] },
  },
  tour: {
    preset: { ko: "none", en: "none" },
    parts: { ko: [["s1", "구성 1", "첫 번째 구성 요소"]], en: [["s1", "Stop 1", "First component"]] },
    sample: { ko: ["s1-overview", "s1", null], en: ["s1-overview", "s1", null] },
  },
};

// Series line and sample-slide wording for flows other than case-first.
const FLOW_WORDS = {
  concept: {
    ko: { series: "개념을 차례로 쌓는 학습 자료", sample: [
      ["무슨 일이 있었는지 한 문장으로 쓴다", "이 장이 답하는 질문을 한 문장으로 쓴다"],
      ["보인 것", "이미 아는 것"], ["관측한 사실만 쓴다. 숫자는 이해를 돕는 것만 남긴다.", "독자가 알고 있다고 가정한 것을 쓴다."],
      ['...seenText, tone: "problem"', '...seenText, tone: "concept"'], ["다음 장에서 볼 것", "이 장에서 볼 것"], ["원인을 찾으려면 어떤 개념이 필요한지 적는다.", "그림으로 보여 줄 관계를 적는다."],
    ] },
    en: { series: "A study that builds one idea at a time", sample: [
      ["What happened, in one sentence", "The question this slide answers, in one sentence"],
      ['"Observed"', '"What you know"'], ["Only what was observed. Keep the numbers that help understanding.", "What the reader is assumed to know already."],
      ['...seenText, tone: "problem"', '...seenText, tone: "concept"'], ['"Next slide"', '"On this slide"'], ["Which concept the reader needs to find the cause.", "The relationship the figure will show."],
    ] },
  },
  comparison: {
    ko: { series: "두 가지를 견주는 학습 자료", sample: [
      ["무슨 일이 있었는지 한 문장으로 쓴다", "무엇과 무엇을 비교하는지 한 문장으로 쓴다"],
      ["보인 것", "A"], ["관측한 사실만 쓴다. 숫자는 이해를 돕는 것만 남긴다.", "첫 번째 선택지의 특징을 쓴다."],
      ['...seenText, tone: "problem"', '...seenText, tone: "concept"'], ["다음 장에서 볼 것", "B"], ["원인을 찾으려면 어떤 개념이 필요한지 적는다.", "두 번째 선택지의 특징을 쓴다."],
    ] },
    en: { series: "A study that compares two options", sample: [
      ["What happened, in one sentence", "What is being compared, in one sentence"],
      ['"Observed"', '"Option A"'], ["Only what was observed. Keep the numbers that help understanding.", "What sets the first option apart."],
      ['...seenText, tone: "problem"', '...seenText, tone: "concept"'], ['"Next slide"', '"Option B"'], ["Which concept the reader needs to find the cause.", "What sets the second option apart."],
    ] },
  },
  tour: {
    ko: { series: "처음부터 끝까지 둘러보는 학습 자료", sample: [
      ["무슨 일이 있었는지 한 문장으로 쓴다", "이 구성 요소가 하는 일을 한 문장으로 쓴다"],
      ["보인 것", "들어오는 것"], ["관측한 사실만 쓴다. 숫자는 이해를 돕는 것만 남긴다.", "이 구성 요소가 받는 입력을 쓴다."],
      ['...seenText, tone: "problem"', '...seenText, tone: "concept"'], ["다음 장에서 볼 것", "나가는 것"], ["원인을 찾으려면 어떤 개념이 필요한지 적는다.", "다음 구성 요소로 넘기는 것을 쓴다."],
    ] },
    en: { series: "A walk through a system, end to end", sample: [
      ["What happened, in one sentence", "What this component does, in one sentence"],
      ['"Observed"', '"In"'], ["Only what was observed. Keep the numbers that help understanding.", "What this component receives."],
      ['...seenText, tone: "problem"', '...seenText, tone: "concept"'], ['"Next slide"', '"Out"'], ["Which concept the reader needs to find the cause.", "What it hands to the next component."],
    ] },
  },
};

const T = {
  ko: {
    series: "주제로 읽는 학습 자료",
    parts: `{
    intro: { label: "들어가며" },
    c1: { label: "사건 1", topic: "첫 번째 사건" },
    outro: { label: "마무리" },
  }`,
    cover: `slide({
    id: "cover",
    chrome: "cover",
    title: "TITLE",
    subtitle: "이 자료가 답하려는 질문을 한 문장으로 쓴다",
  })`,
    sample: `slide({
    id: "c1-situation",
    part: "c1",
    step: "상황",
    kind: "flow",
    title: "무슨 일이 있었는지 한 문장으로 쓴다",
    subtitle: "독자가 무엇을 보게 되는지 한 문장으로 덧붙인다",
    takeaway: "이 장에서 독자가 가져갈 한 문장이다.",
    source: "근거 evidence/sources.md §1",
    claims: [],
  }, (s) => {
    const [top, bottom] = s.rows(s.body, [2, 1], 32);
    s.flow(top, [
      { title: "요청", body: "무엇이 들어왔는가" },
      { title: "처리", body: "어디를 거쳤는가" },
      { title: "결과", body: "무엇이 달라졌는가", tone: "problem" },
    ], { valign: "center" });
    const [seen, next] = s.cols(bottom, 2, 32);
    const seenText = { title: "보인 것", body: "관측한 사실만 쓴다. 숫자는 이해를 돕는 것만 남긴다." };
    const nextText = { title: "다음 장에서 볼 것", body: "원인을 찾으려면 어떤 개념이 필요한지 적는다." };
    const h = Math.max(s.cardHeight(seen.w, seenText), s.cardHeight(next.w, nextText));
    s.card({ ...seen, h }, { ...seenText, tone: "problem", align: "left" });
    s.card({ ...next, h }, { ...nextText, tone: "info", align: "left" });
  })`,
  },
  en: {
    series: "A study built from real cases",
    parts: `{
    intro: { label: "Intro" },
    c1: { label: "Case 1", topic: "First case" },
    outro: { label: "Wrap-up" },
  }`,
    cover: `slide({
    id: "cover",
    chrome: "cover",
    title: "TITLE",
    subtitle: "The question this material answers, in one sentence",
  })`,
    sample: `slide({
    id: "c1-situation",
    part: "c1",
    step: "Situation",
    kind: "flow",
    title: "What happened, in one sentence",
    subtitle: "What the reader is about to see",
    takeaway: "The one sentence the reader should keep.",
    source: "Source: evidence/sources.md §1",
    claims: [],
  }, (s) => {
    const [top, bottom] = s.rows(s.body, [2, 1], 32);
    s.flow(top, [
      { title: "Request", body: "What came in" },
      { title: "Work", body: "Where it went" },
      { title: "Result", body: "What changed", tone: "problem" },
    ], { valign: "center" });
    const [seen, next] = s.cols(bottom, 2, 32);
    const seenText = { title: "Observed", body: "Only what was observed. Keep the numbers that help understanding." };
    const nextText = { title: "Next slide", body: "Which concept the reader needs to find the cause." };
    const h = Math.max(s.cardHeight(seen.w, seenText), s.cardHeight(next.w, nextText));
    s.card({ ...seen, h }, { ...seenText, tone: "problem", align: "left" });
    s.card({ ...next, h }, { ...nextText, tone: "info", align: "left" });
  })`,
  },
};

function main() {
  const args = process.argv.slice(2);
  const val = (flag, d) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : d;
  };
  const valued = new Set(["--name", "--title", "--lang", "--steps", "--flow"]);
  const target = args.find((a, i) => !a.startsWith("--") && !valued.has(args[i - 1]));
  if (!target) {
    console.error("usage: node new.mjs <dir> [--name id] [--title text] [--lang ko|en] [--flow case|concept|comparison|tour] [--steps preset]");
    return 1;
  }
  const dir = path.resolve(target);
  if (fs.existsSync(path.join(dir, "study.config.mjs"))) {
    console.error(`${dir} already has study.config.mjs; not overwriting`);
    return 1;
  }
  const lang = val("--lang", "ko");
  const t = { ...(T[lang] ?? T.en) };
  const name = val("--name", path.basename(dir)).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "study";
  const title = val("--title", lang === "ko" ? "학습 자료 제목" : "Study title");
  const flowName = val("--flow", "case");
  const flow = FLOWS[flowName];
  if (!flow) {
    console.error(`unknown --flow ${flowName}; use case, concept, comparison or tour`);
    return 1;
  }
  const lk = lang === "ko" ? "ko" : "en";
  const steps = val("--steps", flow.preset[lk]);
  const [sampleId, samplePart, sampleStep] = flow.sample[lk];
  const intro = lk === "ko" ? ["들어가며", "마무리"] : ["Intro", "Wrap-up"];
  t.parts = `{
    intro: { label: ${JSON.stringify(intro[0])} },
${flow.parts[lk].map(([id, label, topic]) => `    ${id}: { label: ${JSON.stringify(label)}, topic: ${JSON.stringify(topic)} },`).join("\n")}
    outro: { label: ${JSON.stringify(intro[1])} },
  }`;
  const words = FLOW_WORDS[flowName]?.[lk];
  if (words) {
    t.series = words.series;
    for (const [from, to] of words.sample) t.sample = t.sample.replace(from, to);
  }
  t.sample = t.sample
    .replace('id: "c1-situation"', `id: ${JSON.stringify(sampleId)}`)
    .replace('part: "c1"', `part: ${JSON.stringify(samplePart)}`)
    .replace(/step: "[^"]+",\n/, sampleStep ? `step: ${JSON.stringify(sampleStep)},\n` : "");

  fs.mkdirSync(path.join(dir, "slides"), { recursive: true });
  fs.mkdirSync(path.join(dir, "evidence", "labs"), { recursive: true });
  const put = (rel, content) => {
    const file = path.join(dir, rel);
    if (fs.existsSync(file)) return;
    fs.writeFileSync(file, content);
  };
  put("study.config.mjs", `// See references/kit-api.md in the skill for every option.
export default {
  name: ${JSON.stringify(name)},
  title: ${JSON.stringify(title)},
  series: ${JSON.stringify(t.series)},
  lang: ${JSON.stringify(lang)},
  steps: ${JSON.stringify(steps)},
  parts: ${t.parts},
  // term -> id of the slide that explains it; lint fails if a slide uses it earlier
  glossary: {},
  writing: {
    // words this study must never use, and preferred terms
    banned: [],
    replace: {},
    maxNumbersPerSlide: 12,
  },
  lint: {
    // rule-id: "who decided and why", added only with the user's agreement
    ignore: {},
  },
};
`);
  put("slides/00-cover.mjs", `export default ({ slide }) => [\n  ${t.cover.replace("TITLE", title)},\n];\n`);
  put(`slides/10-${samplePart}.mjs`, `export default ({ slide }) => [\n  ${t.sample},\n];\n`);
  for (const f of ["brief.md", "plan.md", "README.md"]) put(f, fs.readFileSync(path.join(templates, lang === "ko" ? "ko" : "en", f), "utf8").replaceAll("{{TITLE}}", title).replaceAll("{{NAME}}", name));
  put("evidence/claims.md", fs.readFileSync(path.join(templates, lang === "ko" ? "ko" : "en", "claims.md"), "utf8"));
  put("evidence/sources.md", fs.readFileSync(path.join(templates, lang === "ko" ? "ko" : "en", "sources.md"), "utf8"));
  put("evidence/labs/README.md", fs.readFileSync(path.join(templates, lang === "ko" ? "ko" : "en", "labs.md"), "utf8"));
  console.log(`created ${dir}`);
  console.log("next: fill brief.md, then evidence/, then plan.md, then slides/");
  return 0;
}

process.exit(main());
