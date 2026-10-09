export default ({ slide }) => [
  slide({
    id: "cover",
    chrome: "cover",
    title: "하루치 주문 조회로 배우는 B-tree 범위 스캔",
    subtitle: "실행 계획을 읽고 인덱스가 범위를 찾는 방식을 본다",
    meta: "예제 상황 · 로컬 PostgreSQL 18.6에서 재현",
    items: [
      { text: "테이블 전체를 읽은 쿼리", ref: "situation" },
      { text: "실행 계획 읽기", ref: "plan-before" },
      { text: "Buffers와 공유 버퍼", ref: "buffers" },
      { text: "B-tree에서 범위를 읽는 방식", ref: "btree" },
      { text: "조건에 쓴 식과 인덱스에 저장한 식", ref: "function-order" },
      { text: "함수의 변동성", ref: "volatility" },
      { text: "범위 조건으로 고치기", ref: "fix" },
      { text: "대안: 표현식 인덱스", ref: "expr-index" },
      { text: "이제 설명할 수 있는 것", ref: "recap" },
    ],
  }),
];
