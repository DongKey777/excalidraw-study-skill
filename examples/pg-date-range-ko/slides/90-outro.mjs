export default ({ slide }) => [
  slide({
    id: "recap",
    part: "outro",
    kind: "question table",
    title: "이제 설명할 수 있는 것",
    subtitle: "실행 계획에서 시작해 인덱스에서 범위를 읽는 방식까지 따라왔다",
    takeaway: "느린 쿼리를 만나면 실행 계획의 Filter와 Buffers부터 본다.",
    lint: { ignore: ["density"], reason: "마무리 장은 앞 장의 질문과 답을 모은 표라 글이 많은 것이 내용이다" },
    source: "근거 §1 labs/08-pages, 10-shuffled",
    claims: ["C21", "C28", "C42"],
  }, (s) => {
    const b = s.body;
    const [cx, cy] = s.cols({ x: b.x, y: 0, w: b.w, h: 0 }, 2, 32);
    const tryCard = { title: "직접 해 보기", body: "evidence/labs의 SQL을 로컬 PostgreSQL 18에서 돌리고 Buffers 숫자를 비교한다. labs/10에서는 행 순서를 섞으면 플래너가 고르는 계획도 볼 수 있다." };
    const moreCard = { title: "더 볼 것", body: "Index Only Scan과 visibility map\n복합 인덱스의 열 순서\nBitmap Heap Scan" };
    const cardH = Math.max(s.cardHeight(cx.w, tryCard), s.cardHeight(cy.w, moreCard));
    const cardsY = b.y + b.h - cardH;
    s.table({ x: b.x, y: b.y, w: b.w, h: cardsY - 24 - b.y }, [
      ["질문", "답", "다시 볼 장"],
      ["쿼리가 무엇을 읽었는지 어떻게 아나", "실행 계획의 Seq Scan·Filter·Index Cond·Buffers 줄을 본다", "{{#plan-before}}, {{#buffers}}, {{#fix}}장"],
      ["범위 조건은 인덱스를 어떻게 읽나", "시작 키까지 내려가 리프를 옆으로 읽으며 키마다 TID로 테이블 행을 가져오고 끝 키에서 멈춘다", "{{#btree}}장"],
      ["date(created_at) 조건은 왜 인덱스를 못 쓰나", "조건에 쓴 식이 인덱스에 저장한 식과 다르다", "{{#function-order}}장"],
      ["date(created_at)으로는 왜 인덱스를 못 만드나", "date(timestamptz)는 세션 시간대에 따라 결과가 달라지는 STABLE 함수다", "{{#volatility}}장"],
      ["9,600행인데 테이블 접근은 왜 72번뿐인가", "행이 시간 순서로 쌓여 이어지는 TID가 같은 페이지를 가리킨다", "{{#fix}}장"],
      ["무엇을 바꾸면 되나", "조건을 created_at 반열린 범위로 바꾸거나 시간대를 적은 날짜 식으로 표현식 인덱스를 만들고 조건에도 같은 식을 쓴다", "{{#fix}}, {{#expr-index}}장"],
    ], { weights: [4.4, 8.6, 1.4], size: 17, pad: 11, fill: true });
    s.card({ x: cx.x, y: cardsY, w: cx.w, h: cardH }, { ...tryCard, tone: "plain", align: "left" });
    s.card({ x: cy.x, y: cardsY, w: cy.w, h: cardH }, { ...moreCard, tone: "muted", align: "left" });
  }),
];
