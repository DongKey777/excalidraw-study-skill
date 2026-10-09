// Writing profiles. "fail" findings are errors, "warn" findings are
// signals for a person to judge. A study adds its own lists through
// `writing` in study.config.mjs; they are merged on top of the profile.

const ko = {
  register: "plain",
  connectiveComma: "error",
  // Polite endings: -ㅂ니다 (the syllable before 니다 has final ㅂ) and -요 forms.
  speechLevel: (sentence) => {
    const t = sentence.replace(/[\s.!?)"'」』]+$/, "");
    if (t.endsWith("니다") && t.length >= 3) {
      const c = t.codePointAt(t.length - 3) - 0xac00;
      if (c >= 0 && c < 11172 && c % 28 === 17) return true;
    }
    return /(어요|아요|해요|예요|에요|세요|네요|군요|까요|래요|대요|죠)$/.test(t);
  },
  contrast: /아니라|아니고/g,
  connective: /[가-힣](고|며|지만|는데|은데|면서|아서|어서|니까|므로),\s/,
  // Numbers that name or point rather than measure; the numbers rule skips them.
  // "5만 6천" is one quantity.
  numberPattern: /\d[\d,.]*(?:\s?[만억](?:\s?\d[\d,.]*\s?[천백])?)?/g,
  identifiers: [/사건\s?\d+(?:\s?[·~,]\s?\d+)*/g, /\d+\s?장/g, /\d{1,2}월\s?\d{1,2}일/g, /\d{1,2}월/g, /\d{1,2}시(?!간)/g],
  fail: [
    { re: /(?<!인)덱(?!스)/, why: "'덱'은 쓰지 않는다. '자료'라고 쓴다" },
    { re: /가능성이 있을 수/, why: "가능성을 겹쳐 쓰지 않는다. '~할 수 있다'" },
  ],
  warn: [
    { re: /(살펴보|알아보)(자|겠|기|도록)/, why: "예고 없이 바로 설명한다" },
    { re: /다음과 같(다|이|은)/, why: "예고 문장 대신 내용을 바로 쓴다" },
    { re: /에\s?대(한|해|하여)\s/, why: "'~에 대한'은 풀 수 있으면 푼다" },
    { re: /(을|를)\s?통(해|한|하여)\s/, why: "'~을 통해'는 풀 수 있으면 푼다" },
    { re: /에 있어서?\s/, why: "'~에 있어'는 번역투다" },
    { re: /에 의(해|한|하여)\s/, why: "피동 대신 주어를 세운다" },
    { re: /가지고 있/, why: "'~이 있다'로 줄인다" },
    { re: /(을|를|의)\s?(수행|진행)(한다|했다|하는|하여|된다)/, why: "명사+수행 대신 동사를 쓴다" },
    { re: /[가-힣](는|은|던) 것(이다|입니다)/, why: "'~하는 것이다' 대신 바로 쓴다" },
    { re: /(획기적|혁신적|철저히|견고한|게임 체인저|마법 같|여정|한눈에 보는|총정리|완벽 가이드)/, why: "과장·평가어 대신 무엇이 달라졌는지 쓴다" },
    { re: /(심장|척추|숨통|발목을 잡|족쇄|청구서|지렛대|갈림길|교과서적|역설|죽는다|태운다|손가락)/, why: "비유 대신 실제 동작을 쓴다" },
    { re: /(묻는다|약속한다|선언한다|알려 준다|알려준다)/, why: "사물을 사람처럼 쓰지 않는다" },
    { re: /^(이를|이러한|해당)\s/m, why: "지시어가 가리키는 명사를 다시 쓴다" },
    { re: /상한/, why: "'제한 시간', '최대 횟수'처럼 풀어 쓴다" },
    { re: /(?<!(?:^|[\s(])(?:화|측|표|단|전|반|정|후|국|장|평|곡|방|내|외|대|양))(?<=[가-힣])면,\s/, why: "'-면' 뒤에도 쉼표를 찍지 않는다 (명사면 무시)" },
    { re: /(핵심은|결론적으로|요컨대|즉,)/, why: "정리 문구 없이 내용으로 말한다" },
  ],
};

const en = {
  register: null,
  connectiveComma: "off",
  speechLevel: null,
  contrast: /\bnot\s+\w+,?\s+but\b/gi,
  connective: null,
  identifiers: [/\b(case|slide|chapter|step|part|incident)\s?\d+/gi, /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s\d{1,2}\b/g],
  fail: [],
  warn: [
    { re: /\b(delve|tapestry|testament to|game[- ]changer|seamless(ly)?|unlock(s|ing)? the|supercharge|in today's)\b/i, why: "stock AI phrasing" },
    { re: /\b(let's (dive|explore|take a look)|in this (section|slide) we)\b/i, why: "announce-then-say; just say it" },
    { re: /\b(crucial|pivotal|robust|revolutionary|cutting-edge|powerful)\b/i, why: "evaluation word; say what changed" },
    { re: /\bit is important to note\b/i, why: "filler" },
  ],
};

export const PROFILES = { ko, en };

// Identifiers in any language: PR and issue numbers, migration versions,
// section marks, commit hashes, dates, clock times and product versions.
const IDENTIFIERS = [
  /PR\s?#\d+/g, /\b[A-Za-z]+\d+[A-Za-z\d]*\b/g, /#\d+/g, /\bV\d+(?:__\w+)?/g, /§\s?\d[\d.·-]*/g,
  /\b(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b/g,
  /\b\d{1,2}\/\d{1,2}(?:\s?[~-]\s?\d{1,2}(?:\/\d{1,2})?)?/g, /\b\d{4}-\d{2}-\d{2}\b/g, /\b\d{1,2}:\d{2}\b/g,
  /\b(PostgreSQL|Postgres|PG|MySQL|Java|Node|Spring Boot|pgjdbc|Excalidraw|excalidraw@)\s?\d+(?:\.\d+)*/gi,
];

const globalRe = (item) => {
  if (item instanceof RegExp) return item.global ? item : new RegExp(item.source, `${item.flags}g`);
  return new RegExp(String(item).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
};

function toRule(item, fallbackWhy) {
  if (item instanceof RegExp) return { re: item, why: fallbackWhy };
  if (typeof item === "string") return { re: new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), why: fallbackWhy, word: item };
  const re = item.re instanceof RegExp ? item.re : new RegExp(item.re);
  return { re, why: item.why ?? fallbackWhy };
}

export function writingProfile(config) {
  const lang = config.writing?.profile ?? config.lang ?? "ko";
  const base = PROFILES[lang] ?? PROFILES.en;
  const w = config.writing ?? {};
  return {
    lang,
    register: w.register === undefined ? base.register : w.register,
    connectiveComma: w.connectiveComma ?? base.connectiveComma,
    speechLevel: base.speechLevel,
    contrast: base.contrast,
    connective: base.connective,
    maxNumbersPerSlide: w.maxNumbersPerSlide ?? 12,
    numberPattern: base.numberPattern ?? /\d[\d,.]*/g,
    identifiers: [...IDENTIFIERS, ...(base.identifiers ?? []), ...(w.identifiers ?? []).map(globalRe)],
    maxContrastPerSlide: w.maxContrastPerSlide ?? 1,
    requireTimezone: w.requireTimezone ?? false,
    fail: [...base.fail, ...(w.banned ?? []).map((b) => toRule(b, "banned by study.config.mjs"))],
    warn: [...base.warn, ...(w.warn ?? []).map((b) => toRule(b, "flagged by study.config.mjs"))],
    replace: Object.entries(w.replace ?? {}).map(([from, to]) => ({ ...toRule(from, `use "${to}"`), to })),
    variants: w.variants ?? [],
  };
}
