// See references/kit-api.md in the skill for every option.
export default {
  name: "pg-date-range",
  title: "하루치 주문 조회로 배우는 B-tree 범위 스캔",
  series: "예제 · 느린 쿼리로 배우는 PostgreSQL 18",
  lang: "ko",
  steps: "case-first-ko",
  parts: {
    intro: { label: "들어가며" },
    case: { label: "예제 상황", topic: "하루치 주문 조회" },
    outro: { label: "마무리" },
  },
  // term -> id of the slide that explains it
  glossary: {
    "timestamptz": "situation",
    "KST": "situation",
    "Seq Scan": "plan-before",
    "Filter": "plan-before",
    "Buffers": "plan-before",
    "Index Scan": "btree",
    "리프": "btree",
    "TID": "btree",
    "반열린 범위": "function-order",
    "STABLE": "volatility",
    "IMMUTABLE": "volatility",
    "Index Cond": "fix",
    "Index Searches": "fix",
    "표현식 인덱스": "expr-index",
  },
  writing: {
    banned: [],
    replace: { "표를 조회": "테이블을 조회" },
    maxNumbersPerSlide: 12,
  },
  lint: {
    ignore: {},
  },
};
