export default ({ slide }) => [
  slide({
    id: "situation",
    part: "case",
    step: "상황",
    kind: "code + page grid",
    title: "하루치 주문 금액을 더하는 쿼리가 테이블 전체를 읽었다",
    subtitle: "7월 1일 주문은 9,600건이고 테이블에는 100만 건이 있다",
    takeaway: "필요한 행은 약 1%인데 PostgreSQL은 모든 행을 확인했다.",
    source: "근거 §1 labs/01-data, 08-pages · 로컬에서 재현한 예제 상황",
    claims: ["C1", "C2", "C3", "C13", "C17", "C21", "C40"],
  }, (s) => {
    const [top, bottom] = s.rows(s.body, [170, 354], 40);
    const [codeCell, tableCell] = s.cols(top, [11, 8], 48);
    s.code("SELECT sum(amount)\nFROM orders\nWHERE date(created_at) = '2026-07-01';", codeCell.x, codeCell.y, codeCell.w, codeCell.h, { highlight: [2] });
    s.card(tableCell, {
      title: "orders 테이블",
      body: "주문 100만 건을 9초에 한 건씩 시간 순서로 넣었다(약 100일). created_at은 timestamptz(timestamp with time zone) 열이고 인덱스가 있다. 날짜는 KST(UTC+9, Asia/Seoul) 기준이다.",
      tone: "info",
      align: "left",
    });
    s.label("테이블은 8kB 페이지 7,353개다 (칸 하나가 테이블의 1%)", bottom.x, bottom.y, bottom.w, { size: 17 });
    const cols = 25;
    const rows = 4;
    const gap = 6;
    const size = Math.floor((bottom.w - gap * (cols - 1)) / cols);
    const gridY = bottom.y + 38;
    const pages = 7353;
    const july = [2117, 2189];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = bottom.x + c * (size + gap);
        const y = gridY + r * (size + gap);
        s.rect(x, y, size, size, { fill: s.C.white, stroke: s.C.red, strokeWidth: 1.5, radius: 4, hint: "page" });
        const i = r * cols + c;
        const from = Math.max(july[0], (i * pages) / 100);
        const to = Math.min(july[1], ((i + 1) * pages) / 100);
        if (to > from) {
          const x0 = x + 4 + ((from - (i * pages) / 100) / (pages / 100)) * (size - 8);
          const x1 = x + 4 + ((to - (i * pages) / 100) / (pages / 100)) * (size - 8);
          s.rect(x0, y + 5, x1 - x0, size - 10, { fill: s.C.greenSoft, stroke: s.C.green, strokeWidth: 3, radius: 3, hint: "july-1" });
        }
      }
    }
    s.note("시간 순서로 넣어서 7월 1일 주문은 이웃한 페이지(초록, 두 칸의 경계에 걸쳐 있다)에 모여 있다. 쿼리는 빨간 테두리의 100칸을 모두 읽었다.", bottom.x, gridY + rows * (size + gap) + 14, bottom.w);
  }),

  slide({
    id: "plan-before",
    part: "case",
    step: "분석",
    kind: "plan excerpt",
    title: "실행 계획에 Seq Scan과 Filter가 찍혔다",
    subtitle: "EXPLAIN ANALYZE는 쿼리를 실제로 실행하고 노드(Seq Scan 같은 처리 단위)마다 한 일을 적는다",
    takeaway: "조건이 인덱스 검색에 쓰이지 못하고 읽은 행을 거르는 Filter에만 쓰였다.",
    source: "근거 §1 labs/02-before, 12-parallel · §2 · §6",
    claims: ["C2", "C3", "C4", "C8", "C14", "C31", "C32", "C33"],
  }, (s) => {
    const [left, right] = s.cols(s.body, [3, 2], 48);
    const plan = [
      "SET TIME ZONE 'Asia/Seoul';",
      "SET max_parallel_workers_per_gather = 0;",
      "EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)",
      "SELECT sum(amount) FROM orders WHERE date(created_at) = '2026-07-01';",
      "",
      "Aggregate (actual time=54.847..54.852 rows=1.00 loops=1)",
      "  Buffers: shared hit=7353",
      "  ->  Seq Scan on orders (actual time=19.151..54.570 rows=9600.00 loops=1)",
      "        Filter: (date(created_at) = '2026-07-01'::date)",
      "        Rows Removed by Filter: 990400",
      "        Buffers: shared hit=7353",
      "…",
      "Execution Time: 54.894 ms",
    ].join("\n");
    const codeH = 336;
    s.code(plan, left.x, left.y, left.w, codeH, { size: 17, highlight: [7, 8, 9, 10] });
    const n = s.note("SET 두 줄은 실험 조건이다. 계획을 읽기 쉽게 병렬 실행을 껐고 COSTS OFF로 비용 추정을 뺐다. 병렬 실행을 끄지 않으면 여러 프로세스가 나눠 읽는 계획(Gather 아래 Parallel Seq Scan)이 나오고 Buffers 합은 같은 7,353이다.", left.x, left.y + codeH + 14, left.w, { size: 16 });
    const flowY = n.y + n.h + 20;
    s.flow({ x: left.x, y: flowY, w: left.w, h: left.y + left.h - flowY }, [
      { title: "Seq Scan", body: "테이블의 페이지를 처음부터 끝까지 읽으며 행마다 Filter 조건을 계산한다. 인덱스를 쓰지 않았다.", tone: "problem", weight: 3 },
      { title: "Aggregate", body: "남은 9,600행의 amount를 더한다", weight: 2 },
    ], { gap: 48, bodySize: 17, valign: "bottom" });
    const cards = [
      { title: "Filter", body: "읽은 행마다 조건을 계산해 맞지 않는 행을 버린다. 이 쿼리는 990,400행을 버렸다." },
      { title: "Buffers", body: "쿼리가 페이지에 접근한 횟수다. Seq Scan은 페이지마다 한 번 접근하므로 7,353은 테이블 전체다. 위 노드의 값은 아래 노드의 접근을 포함한 누계라서 두 줄을 더하지 않는다." },
      { title: "숫자 읽는 법", body: "actual time은 첫 행과 마지막 행이 나온 시각(ms)이고 한 번 잰 참고값이다. rows는 노드를 한 번 실행할 때 나온 행 수의 평균이다. PostgreSQL 18부터 소수 둘째 자리까지 보인다. loops는 실행 횟수다." },
    ];
    const cells = s.rows(right, cards.map((c) => s.cardHeight(right.w, c)), 20);
    cards.forEach((c, i) => s.card(cells[i], { ...c, tone: "concept", align: "left" }));
  }),

  slide({
    id: "buffers",
    part: "case",
    step: "원리",
    kind: "memory structure",
    title: "Buffers는 쿼리가 페이지에 접근한 횟수를 센다",
    subtitle: "실행 시간은 캐시와 하드웨어에 따라 달라지지만 접근 횟수는 쿼리가 한 일의 양이다",
    takeaway: "hit와 read를 더하면 쿼리가 페이지에 접근한 횟수가 나온다.",
    source: "근거 §2 · §1 labs/02-before, 05-explain-default",
    claims: ["C8", "C12", "C13", "C14", "C36"],
  }, (s) => {
    const b = s.body;
    const panelY = b.y + 4;
    const panelH = 306;
    const pageW = 90;
    const pageH = 54;
    const slot = (area, col, row) => ({ x: area.x + 24 + col * 110, y: area.y + 96 + row * 66 });
    const shared = { x: b.x + 290, y: panelY, w: 492, h: panelH };
    const disk = { x: b.x + b.w - 492, y: panelY, w: 492, h: panelH };
    const query = { x: b.x, y: panelY + 134, w: 180, h: 110 };
    s.card(query, { title: "쿼리 실행", body: "페이지를 요청한다", tone: "plain", bodySize: 17 });
    s.rect(shared.x, shared.y, shared.w, shared.h, { fill: s.C.purpleSoft, stroke: s.C.purple, hint: "shared" });
    s.text("공유 버퍼 · 메모리", shared.x + 24, shared.y + 20, shared.w - 48, { size: 20, color: s.C.purple });
    s.label("shared_buffers 설정 크기만큼 담는다 · 점선은 빈 자리", shared.x + 24, shared.y + 52, shared.w - 48, { size: 15, color: s.C.mutedStrong });
    s.rect(disk.x, disk.y, disk.w, disk.h, { fill: s.C.slateSoft, stroke: s.C.slate, hint: "disk" });
    s.text("OS 캐시 · 디스크", disk.x + 24, disk.y + 20, disk.w - 48, { size: 20, color: s.C.slate });
    s.label("테이블 파일이 8kB 페이지로 나뉘어 있다", disk.x + 24, disk.y + 52, disk.w - 48, { size: 15, color: s.C.mutedStrong });
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const p = slot(shared, col, row);
        const empty = col === 3 && row >= 1;
        const hit = col === 0 && row === 1;
        if (empty) s.rect(p.x, p.y, pageW, pageH, { fill: s.C.purpleSoft, stroke: s.C.purple, strokeStyle: "dashed", strokeWidth: 1, radius: 5, hint: "empty-slot" });
        else s.page(p.x, p.y, hit ? "hit" : "", { fill: hit ? s.C.purple : s.C.white, stroke: s.C.purple, color: s.C.white, width: pageW, height: pageH, size: 16 });
        const d = slot(disk, col, row);
        const read = col === 0 && row === 1;
        s.page(d.x, d.y, read ? "read" : "", { fill: read ? s.C.slate : s.C.white, stroke: s.C.slate, color: s.C.white, width: pageW, height: pageH, size: 16 });
      }
    }
    const hitPage = slot(shared, 0, 1);
    const emptySlot = slot(shared, 3, 1);
    const readPage = slot(disk, 0, 1);
    const midY = hitPage.y + pageH / 2;
    s.connect({ x: hitPage.x, y: hitPage.y, w: pageW, h: pageH }, query, { color: s.C.purple, y: midY });
    s.connect({ x: readPage.x, y: readPage.y, w: pageW, h: pageH }, { x: emptySlot.x, y: emptySlot.y, w: pageW, h: pageH }, { color: s.C.slate, y: midY });
    s.text("shared hit", query.x + query.w, midY - 38, shared.x - query.x - query.w, { size: 15, color: s.C.purple, align: "center" });
    s.text("shared read", shared.x + shared.w, midY - 38, disk.x - shared.x - shared.w, { size: 15, color: s.C.slate, align: "center" });
    s.text("빈 자리로 가져온다", shared.x + shared.w, midY + 16, disk.x - shared.x - shared.w, { size: 15, color: s.C.muted, align: "center" });
    const cardsY = panelY + panelH + 26;
    const noteH = 26;
    const [c1, c2, c3] = s.cols({ x: b.x, y: cardsY, w: b.w, h: b.y + b.h - cardsY - noteH - 12 }, 3, 28);
    s.card(c1, { title: "shared hit", body: "공유 버퍼에 있던 페이지를 썼다. date() 조건 쿼리는 7,353번 모두 hit였는데도 약 55ms가 걸렸다. 100만 행을 하나씩 확인한 시간이다.", tone: "memory", align: "left" });
    s.card(c2, { title: "shared read", body: "공유 버퍼에 없어서 OS에 요청해 읽어 왔다. 그 페이지가 OS 캐시에 있었는지는 EXPLAIN에 나오지 않는다.", tone: "muted", align: "left" });
    s.card(c3, { title: "세는 방식", body: "페이지에 한 번 접근하면 hit와 read 중 하나로만 센다. 같은 페이지에 두 번 접근하면 두 번 센다. 그래서 Buffers는 페이지 수가 아니라 접근 횟수다.", tone: "concept", align: "left" });
    s.note("PostgreSQL 18부터 EXPLAIN ANALYZE는 BUFFERS를 따로 켜지 않아도 Buffers 줄을 보여 준다.", b.x, b.y + b.h - noteH, b.w, { size: 16 });
  }),

  slide({
    id: "btree",
    part: "case",
    step: "원리",
    kind: "tree structure + table pages",
    title: "B-tree 리프는 키 순서로 정렬되고 옆 리프와 이어진다",
    subtitle: "created_at 인덱스에서 7월 1일 키를 찾아 읽는 순서를 본다",
    takeaway: "Index Scan은 시작 키까지 내려가 리프를 옆으로 읽으며 키마다 TID로 테이블 행을 가져오고 끝 키에서 멈춘다.",
    source: "근거 §3 · §2 · §1 labs/08-pages",
    claims: ["C15", "C21", "C22", "C38", "C41"],
  }, (s) => {
    const b = s.body;
    const hot = s.C.green;
    const mono = s.theme.font.mono;
    const treeX = b.x + 90;
    const rowLabel = (text, y) => s.label(text, b.x, y, 84, { size: 15, color: s.C.mutedStrong });
    const keyBox = (r, key) => s.box(r.x, r.y, r.w, r.h, key, "", { tone: "muted", titleSize: 15, titleFamily: mono });
    const root = { x: treeX + 368, y: b.y + 8, w: 180, h: 48 };
    const in1 = { x: treeX + 114, y: b.y + 108, w: 180, h: 48 };
    const in2 = { x: treeX + 622, y: b.y + 108, w: 180, h: 48 };
    keyBox(root, "07-01 12:00:00");
    keyBox(in1, "07-01 00:00:00");
    keyBox(in2, "07-02 00:00:09");
    rowLabel("루트", root.y + 14);
    rowLabel("내부\n페이지", in1.y + 4);
    const leafY = b.y + 212;
    const leafW = 180;
    const leafH = 104;
    const xs = [treeX, treeX + 228, treeX + 508, treeX + 736];
    const keys = [
      ["06-30 23:59:33", "06-30 23:59:42", "06-30 23:59:51"],
      ["07-01 00:00:00", "07-01 00:00:09", "07-01 00:00:18"],
      ["07-01 23:59:42", "07-01 23:59:51", "07-02 00:00:00"],
      ["07-02 00:00:09", "07-02 00:00:18", "07-02 00:00:27"],
    ];
    const rowY = (k) => leafY + 16 + k * 25;
    const leaves = keys.map((ks, i) => {
      const r = { x: xs[i], y: leafY, w: leafW, h: leafH };
      const inRange = i === 1 || i === 2;
      s.rect(r.x, r.y, r.w, r.h, { fill: inRange ? s.C.greenSoft : s.C.white, stroke: inRange ? hot : s.C.line, strokeWidth: inRange ? 3 : 2, hint: "leaf" });
      ks.forEach((k, j) => {
        const end = i === 2 && j === 2;
        if (end) s.rect(r.x + 8, rowY(j) - 3, leafW - 16, 25, { fill: s.C.white, stroke: s.C.redText, strokeStyle: "dashed", strokeWidth: 1.5, radius: 4, hint: "end-key" });
        s.text(k, r.x + 16, rowY(j), 128, { size: 15, family: mono, color: end ? s.C.redText : s.C.ink });
      });
      return r;
    });
    rowLabel("리프", leafY + 40);
    const mid = leafY + leafH / 2;
    s.arrow(root.x + 50, root.y + root.h + 6, in1.x + 130, in1.y - 6, { color: hot, width: 3 });
    s.arrow(root.x + 130, root.y + root.h + 6, in2.x + 50, in2.y - 6, { color: s.C.slate, width: 2 });
    s.arrow(in1.x + 40, in1.y + in1.h + 6, leaves[0].x + 120, leafY - 6, { color: s.C.slate, width: 2 });
    s.arrow(in1.x + 140, in1.y + in1.h + 6, leaves[1].x + 70, leafY - 6, { color: hot, width: 3 });
    s.arrow(in2.x + 40, in2.y + in2.h + 6, leaves[2].x + 110, leafY - 6, { color: s.C.slate, width: 2 });
    s.arrow(in2.x + 140, in2.y + in2.h + 6, leaves[3].x + 60, leafY - 6, { color: s.C.slate, width: 2 });
    s.line(leaves[0].x + leafW, mid, leaves[1].x, mid, { color: s.C.slate, width: 2 });
    s.line(leaves[2].x + leafW, mid, leaves[3].x, mid, { color: s.C.slate, width: 2 });
    const gapX = leaves[1].x + leafW;
    const gapW = leaves[2].x - gapX;
    s.arrow(gapX + 8, mid, leaves[2].x - 8, mid, { color: hot, width: 3 });
    s.text("리프\n수십 개", gapX, mid + 12, gapW, { size: 15, align: "center", color: hot });
    const pageY = leafY + leafH + 58;
    const pageW = 76;
    const pageH = 44;
    const strip = [
      ["2116", leaves[1].x + leafW / 2 - pageW / 2 - 86, false],
      ["2117", leaves[1].x + leafW / 2 - pageW / 2, true],
      ["2118", leaves[1].x + leafW / 2 + pageW / 2 + 10, true],
      ["2187", leaves[2].x + leafW / 2 - pageW / 2 - 86, true],
      ["2188", leaves[2].x + leafW / 2 - pageW / 2, true],
      ["2189", leaves[2].x + leafW / 2 + pageW / 2 + 10, false],
    ];
    strip.forEach(([n, x, inRange]) => s.page(x, pageY, n, { fill: inRange ? s.C.greenSoft : s.C.white, stroke: inRange ? hot : s.C.line, color: s.C.ink, width: pageW, height: pageH, size: 15 }));
    const dotsX = strip[2][1] + pageW;
    s.text("…", dotsX, pageY + 8, strip[3][1] - dotsX, { size: 18, align: "center", color: hot });
    rowLabel("테이블\n페이지", pageY + 2);
    s.arrow(leaves[1].x + leafW / 2, leafY + leafH + 8, leaves[1].x + leafW / 2, pageY - 8, { color: hot, width: 2 });
    s.arrow(leaves[2].x + leafW / 2 - 30, leafY + leafH + 8, leaves[2].x + leafW / 2 - 30, pageY - 8, { color: hot, width: 2 });
    s.marker(1, root.x - 96, root.y + 34, { color: hot, d: 28 });
    s.marker(2, gapX + gapW / 2 - 14, mid - 44, { color: hot, d: 28 });
    s.marker(4, leaves[2].x + leafW + 10, rowY(2) - 2, { color: hot, d: 26 });
    s.marker(3, leaves[1].x + leafW / 2 - 44, leafY + leafH + 14, { color: hot, d: 28 });
    const stripRight = strip[5][1] + pageW;
    s.label("7월 1일 행이 든\n페이지(초록)", stripRight + 16, pageY + 2, 150, { size: 15, color: s.C.mutedStrong });
    const n = s.note("경계 키는 예로 든 값이다. 실제 created_at 인덱스도 루트·내부·리프 3층이고 리프가 2,733개라서 7월 1일 키는 리프 수십 개에 걸쳐 있다.", b.x, pageY + pageH + 30, leaves[3].x + leafW - b.x, { size: 16 });
    const right = { x: leaves[3].x + leafW + 40, y: b.y, w: b.x + b.w - (leaves[3].x + leafW + 40), h: n.y + n.h - b.y };
    const cards = [
      { title: "리프와 TID", body: "리프는 키를 정렬해 담고 키마다 테이블 행의 위치(TID)를 붙여 둔다. 그림의 키는 created_at을 KST로 쓴 값이다. 같은 층의 페이지는 양옆과 이어져 있다." },
      { title: "Index Scan이 읽는 순서", body: "① 시작 키를 찾아 리프까지 내려간다\n② 리프를 옆으로 이어 읽는다\n③ 읽는 동안 키마다 TID로 테이블 행을 가져온다\n④ 끝 키(붉은 점선)를 만나면 멈춘다" },
    ];
    const cells = s.rows(right, cards.map((c) => s.cardHeight(right.w, c)), 20);
    cards.forEach((c, i) => s.card(cells[i], { ...c, tone: "concept", align: "left" }));
  }),

  slide({
    id: "function-order",
    part: "case",
    step: "원리",
    kind: "comparison on a sorted strip",
    title: "조건에 쓴 식이 인덱스에 저장한 식과 달라서 인덱스를 못 썼다",
    subtitle: "created_at 인덱스는 created_at 값 그대로를 시각 순서로 정렬해 둔다",
    takeaway: "인덱스에는 created_at 값만 있어서 date() 조건은 행마다 계산해 걸러야 한다.",
    source: "근거 §5 · §8 · §1 labs/02-before, 03-after",
    claims: ["C3", "C5", "C19"],
    lint: { ignore: ["numbers"], reason: "정렬된 키 값을 보여 주는 장이라 시각 라벨이 그림의 내용이다" },
  }, (s) => {
    const b = s.body;
    const headW = 160;
    const cellX = b.x + headW + 20;
    const gap = 12;
    const cellW = Math.floor((b.x + b.w - cellX - gap * 8) / 9);
    const hours = ["06-30 22시", "06-30 23시", "07-01 00시", "…", "07-01 12시", "…", "07-01 23시", "07-02 00시", "07-02 01시"];
    const dates = ["06-30", "06-30", "07-01", "…", "07-01", "…", "07-01", "07-02", "07-02"];
    const inRange = (i) => i >= 2 && i <= 6;
    const cx = (i) => cellX + i * (cellW + gap);
    const x0 = cx(2);
    const x1 = cx(6) + cellW;
    const bracketY = b.y + 30;
    s.text("created_at 범위 조건이 읽는 구간", x0, b.y, x1 - x0, { size: 17, align: "center", color: s.C.green });
    s.line(x0, bracketY, x1, bracketY, { color: s.C.green, width: 3 });
    s.line(x0, bracketY, x0, bracketY + 12, { color: s.C.green, width: 3 });
    s.line(x1, bracketY, x1, bracketY + 12, { color: s.C.green, width: 3 });
    const keyY = bracketY + 22;
    const keyH = 56;
    s.text("created_at (KST)\n인덱스에 있다", b.x, keyY + 6, headW, { size: 16, color: s.C.mutedStrong, lineHeight: 1.3 });
    hours.forEach((h, i) => {
      s.rect(cx(i), keyY, cellW, keyH, { fill: inRange(i) ? s.C.greenSoft : s.C.white, stroke: inRange(i) ? s.C.green : s.C.line, strokeWidth: inRange(i) ? 3 : 2, radius: 6, hint: "key" });
      s.text(h, cx(i), keyY + 17, cellW, { size: 17, align: "center", color: s.C.ink });
    });
    const dateY = keyY + keyH + 16;
    const dateH = 48;
    s.text("date(created_at)\n인덱스에 없다", b.x, dateY + 2, headW, { size: 16, color: s.C.redText, lineHeight: 1.3 });
    dates.forEach((d, i) => {
      s.rect(cx(i), dateY, cellW, dateH, { fill: s.C.white, stroke: inRange(i) ? s.C.red : s.C.line, strokeStyle: "dashed", strokeWidth: inRange(i) ? 2 : 1.5, radius: 6, hint: "date-value" });
      s.text(d, cx(i), dateY + 13, cellW, { size: 17, align: "center", color: inRange(i) ? s.C.redText : s.C.muted });
    });
    const colsY = dateY + dateH + 28;
    const [l, r] = s.cols({ x: b.x, y: colsY, w: b.w, h: 10 }, 2, 40);
    s.code("WHERE date(created_at) = '2026-07-01'", l.x, colsY, l.w, 64, { size: 17 });
    s.code("WHERE created_at >= '2026-07-01 00:00:00+09'\n  AND created_at <  '2026-07-02 00:00:00+09'", r.x, colsY, r.w, 64, { size: 15 });
    const leftCard = { title: "식이 다르다", body: "점선 칸의 값은 인덱스에 없다. PostgreSQL은 이 date() 조건을 created_at 범위로 바꾸지 않았고 행마다 date()를 계산해 걸렀다({{#plan-before}}장의 Filter)." };
    const rightCard = { title: "식이 같다", body: "조건에 인덱스에 저장한 created_at을 그대로 썼다. Index Scan은 시작 키부터 읽고 끝 키를 만나면 멈춘다." };
    const cardsY = colsY + 64 + 14;
    const cardH = Math.max(s.cardHeight(l.w, leftCard), s.cardHeight(r.w, rightCard));
    s.card({ x: l.x, y: cardsY, w: l.w, h: cardH }, { ...leftCard, tone: "problem", align: "left" });
    s.card({ x: r.x, y: cardsY, w: r.w, h: cardH }, { ...rightCard, tone: "fix", align: "left" });
    const halfY = cardsY + cardH + 24;
    s.card({ x: b.x, y: halfY, w: b.w, h: b.y + b.h - halfY }, {
      title: "반열린 범위",
      body: "시작은 포함하고(>=) 끝은 빼는(<) 범위다. 07-02 00:00:00 주문은 다음 날에만 들어가 두 번 세지 않는다. +09는 KST다.",
      tone: "concept", align: "left",
    });
  }),

  slide({
    id: "volatility",
    part: "case",
    step: "원리",
    kind: "time zones + table",
    title: "date(timestamptz)는 세션 시간대에 따라 결과가 달라진다",
    subtitle: "date(created_at)으로 인덱스를 만들면 될 것 같지만 이 함수는 STABLE이라 만들 수 없다",
    takeaway: "date(timestamptz)는 STABLE이라 인덱스 정의에 쓸 수 없다.",
    source: "근거 §4 · §7 · §9 · §1 labs/04-volatility, 06-timezone, 11-cast",
    claims: ["C9", "C10", "C16", "C20", "C26", "C30"],
  }, (s) => {
    const b = s.body;
    const volCard = {
      title: "함수의 변동성",
      body: "IMMUTABLE: 같은 입력이면 언제나 같은 결과다\nSTABLE: SQL 문 하나 안에서는 같지만 TimeZone 같은 설정이 바뀌면 달라질 수 있다\n인덱스 정의에는 IMMUTABLE 함수만 쓸 수 있다",
      bodySize: 17,
    };
    const volH = s.cardHeight(b.w, volCard);
    const top = { x: b.x, y: b.y, w: b.w, h: b.h - volH - 24 };
    s.card({ x: b.x, y: b.y + b.h - volH, w: b.w, h: volH }, { ...volCard, tone: "concept", align: "left" });
    const [left, right] = s.cols(top, [5, 6], 48);
    s.label("같은 시각, 두 날짜", left.x, left.y, left.w, { size: 17 });
    s.chip("2026-06-30 15:30 UTC", left.x + left.w / 2, left.y + 36, { anchor: "center", size: 18, fill: s.C.slateSoft, color: s.C.ink });
    const [k, u] = s.cols({ x: left.x, y: left.y + 130, w: left.w, h: 100 }, 2, 28);
    s.card(k, { title: "TimeZone = Asia/Seoul", body: "date() → 2026-07-01", tone: "info", titleSize: 18, bodySize: 18 });
    s.card(u, { title: "TimeZone = UTC", body: "date() → 2026-06-30", tone: "info", titleSize: 18, bodySize: 18 });
    s.arrow(left.x + left.w / 2 - 40, left.y + 78, k.x + k.w / 2, k.y - 8, { color: s.C.slate, width: 2 });
    s.arrow(left.x + left.w / 2 + 40, left.y + 78, u.x + u.w / 2, u.y - 8, { color: s.C.slate, width: 2 });
    s.note("timestamptz는 시각을 UTC로 저장한다. 화면에 보여 줄 때와 date()로 날짜를 꺼낼 때 세션 시간대로 바꾼다. 그래서 같은 행이라도 세션마다 date() 값이 달라 인덱스에 저장할 값을 하나로 정할 수 없다.", left.x, left.y + 252, left.w, { size: 16 });
    const mono = s.theme.font.mono;
    const t = s.table({ x: right.x, y: right.y, w: right.w, h: 0 }, [
      ["인덱스에 쓰려는 식", "부르는 함수", "변동성"],
      [{ t: "date(created_at)", family: mono }, { t: "date(timestamptz)", family: mono }, { t: "STABLE", color: s.C.redText }],
      [{ t: "created_at::date", family: mono }, { t: "date(timestamptz)", family: mono }, { t: "STABLE", color: s.C.redText }],
    ], { weights: [4, 4, 2], size: 16 });
    const codeH = 62;
    const c1y = t.y + t.h + 18;
    s.code("CREATE INDEX orders_created_date_idx ON orders (date(created_at));\nERROR:  functions in index expression must be marked IMMUTABLE", right.x, c1y, right.w, codeH, { size: 14, highlight: [1], highlightFill: "#EF4444" });
    const c2y = c1y + codeH + 12;
    s.code("CREATE INDEX orders_created_cast_idx ON orders ((created_at::date));\nERROR:  functions in index expression must be marked IMMUTABLE", right.x, c2y, right.w, codeH, { size: 14, highlight: [1], highlightFill: "#EF4444" });
    s.note("::date는 date로 형 변환하는 표기다. timestamptz에 쓰면 같은 date(timestamptz)를 불러 같은 오류가 난다.", right.x, c2y + codeH + 12, right.w, { size: 16 });
  }),

  slide({
    id: "fix",
    part: "case",
    step: "해결",
    kind: "plan excerpt + bars + breakdown",
    title: "날짜 조건을 반열린 범위로 바꾸자 Buffers가 7,353에서 102로 줄었다",
    subtitle: "세션 시간대가 Asia/Seoul이면 결과는 같고 Index Scan이 7월 1일 구간만 읽었다",
    takeaway: "인덱스에 저장한 식을 조건에 그대로 쓰면 필요한 범위만 읽는다.",
    source: "근거 §1 labs/02-before, 03-after, 08-pages, 09-split, 10-shuffled · §2 · §6",
    claims: ["C4", "C5", "C6", "C7", "C8", "C21", "C23", "C28", "C34", "C35", "C37", "C42"],
  }, (s) => {
    const b = s.body;
    const plan = [
      "EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)",
      "SELECT sum(amount) FROM orders",
      "WHERE created_at >= '2026-07-01 00:00:00+09' AND created_at < '2026-07-02 00:00:00+09';",
      "…",
      "  ->  Index Scan using orders_created_at_idx on orders (actual time=0.051..0.773 rows=9600.00 loops=1)",
      "        Index Cond: ((created_at >= '2026-07-01 00:00:00+09'::timestamp with time zone) AND (created_at < '2026-07-02 00:00:00+09'::timestamp with time zone))",
      "        Index Searches: 1",
      "        Buffers: shared hit=72 read=30",
      "…",
    ].join("\n");
    const codeH = 196;
    s.code(plan, b.x, b.y, b.w, codeH, { size: 14, highlight: [4, 5, 6, 7] });
    const lowY = b.y + codeH + 24;
    const [ca, cb, cc] = s.cols({ x: b.x, y: lowY, w: b.w, h: b.y + b.h - lowY }, [4, 4.6, 4.4], 36);
    const condCard = { title: "Index Cond와 Index Searches", body: "Index Cond는 인덱스 안에서 검사하는 조건이다. 시작 키(>=)로 내려갈 자리를 찾고 끝 키(<)를 만나면 멈춘다. Index Searches는 루트에서 리프까지 내려간 횟수다." };
    const timeNote = "실행 시간은 약 55ms에서 약 1ms로 줄었다(병렬 끔, 한 번 잰 참고값).";
    const condH = s.cardHeight(ca.w, condCard);
    s.card({ x: ca.x, y: ca.y, w: ca.w, h: condH }, { ...condCard, tone: "concept", align: "left" });
    s.note(timeNote, ca.x, ca.y + condH + 12, ca.w, { size: 16 });
    s.label("Buffers (hit + read)", cb.x, cb.y, cb.w, { size: 17 });
    s.bars({ x: cb.x, y: cb.y + 30, w: cb.w, h: 104 }, [
      { label: "date() 조건", value: 7353, display: "7,353", tone: "problem" },
      { label: "범위 조건", value: 102, display: "102", tone: "fix" },
    ], { labelWidth: 130, valueWidth: 80, size: 18 });
    const splitY = cb.y + 156;
    s.label("102의 구성 (눈금을 키움)", cb.x, splitY, cb.w, { size: 17 });
    const barX = cb.x + 130;
    const barW = cb.w - 130 - 80;
    const parts = [[30, "인덱스 30", "info"], [72, "테이블 72", "muted"]];
    let x = barX;
    for (const [v, text, tone] of parts) {
      const w = Math.round((v / 102) * barW);
      const t = s.theme.tones[tone];
      s.rect(x, splitY + 34, w, 40, { fill: t.fill, stroke: t.stroke, strokeWidth: 2, radius: 4, hint: "part" });
      s.text(text, x, splitY + 44, w, { size: 16, align: "center", color: t.title });
      x += w;
    }
    s.text("범위 조건", cb.x, splitY + 43, 114, { size: 18, color: s.C.ink, align: "right" });
    s.text("= 102", x + 12, splitY + 43, 68, { size: 18, color: s.C.ink });
    s.note("hit·read는 공유 버퍼에 있었는지로 나눈 값이라 기준이 다르다. 같은 쿼리를 다시 돌리면 hit=102다.", cb.x, splitY + 92, cb.w, { size: 16 });
    const whyCard = { title: "테이블 접근이 72번인 이유", body: "7월 1일 행은 시간 순서로 쌓여 72페이지에 모여 있다. 이어지는 TID가 같은 페이지면 다시 읽지 않는다. 행을 섞은 사본에 Index Scan을 강제하면 이어지는 TID가 대부분 다른 페이지를 가리킨다(플래너는 Bitmap Heap Scan을 골랐다)." };
    const whyH = s.cardHeight(cc.w, whyCard);
    s.card({ x: cc.x, y: cc.y, w: cc.w, h: whyH }, { ...whyCard, tone: "info", align: "left" });
    const tableY = cc.y + whyH + 20;
    s.label("같은 Index Scan의 테이블 접근 (사본은 강제)", cc.x, tableY, cc.w, { size: 17 });
    s.bars({ x: cc.x, y: tableY + 26, w: cc.w, h: cc.y + cc.h - tableY - 26 }, [
      { label: "orders", value: 72, display: "72", tone: "fix" },
      { label: "섞은 사본", value: 9598, display: "9,598", tone: "problem" },
    ], { labelWidth: 110, valueWidth: 70, size: 17 });
  }),

  slide({
    id: "expr-index",
    part: "case",
    step: "해결",
    kind: "expression steps + breakdown + options",
    title: "시간대를 적은 날짜 식으로는 표현식 인덱스를 만들 수 있다",
    subtitle: "같은 7월 1일 행을 Buffers 83으로 읽지만 인덱스가 하나 늘어난다",
    takeaway: "표현식 인덱스도 7월 1일 구간만 읽지만 인덱스를 하나 더 둬야 해서 범위 조건을 골랐다.",
    left: "하루를 어느 시간대의 자정에서 자를지는 애플리케이션이 정해 넘긴다. 이 예제는 KST(Asia/Seoul) 자정을 썼다.",
    source: "근거 §1 labs/04-volatility, 07-breakdown, 09-split, 11-cast · §3 · §5 · §10",
    claims: ["C9", "C11", "C23", "C24", "C25", "C27", "C29", "C30", "C39"],
  }, (s) => {
    const b = s.body;
    const steps = s.flow({ x: b.x, y: b.y, w: b.w, h: 120 }, [
      { title: "created_at", body: "2026-06-30 15:30 UTC\ntimestamptz", weight: 3 },
      { title: "AT TIME ZONE 'Asia/Seoul'", body: "timezone(text, timestamptz)\nIMMUTABLE", tone: "concept", weight: 4 },
      { title: "서울 시각 (timestamp)", body: "2026-07-01 00:30:00", weight: 3 },
      { title: "::date", body: "date(timestamp)\nIMMUTABLE", tone: "concept", weight: 3 },
      { title: "date", body: "2026-07-01", weight: 2 },
    ], { gap: 40, bodySize: 17, titleSize: 19 });
    const stepsBottom = steps[0].y + steps[0].h;
    const n1 = s.note("AT TIME ZONE은 timestamptz를 그 시간대의 시각(시간대 없는 timestamp)으로 바꾼다. 시간대가 식에 적혀 있어 세션과 상관없이 같은 날짜가 나오므로 표현식 인덱스(식의 값을 저장하는 인덱스)로 만들 수 있다.", b.x, stepsBottom + 12, b.w, { size: 16 });
    const options = [
      { title: "고른 방법: 범위 조건", body: "인덱스를 더 만들지 않고 기존 created_at 인덱스를 그대로 쓴다. 쿼리는 하루의 시작과 끝 시각을 받는다.", tone: "fix", align: "left" },
      { title: "대안: 표현식 인덱스", body: "쿼리에 같은 식을 적어야 이 인덱스를 쓴다. 인덱스가 하나(852페이지) 늘어나서 행을 넣거나 고칠 때 갱신할 인덱스도 하나 많아진다.", tone: "info", align: "left" },
    ];
    const optH = Math.max(...options.map((o) => s.cardHeight((b.w - 40) / 2, o)));
    const cardsY = b.y + b.h - optH;
    const midY = n1.y + n1.h + Math.round((cardsY - (n1.y + n1.h) - 150) / 2);
    const [cl, cr] = s.cols({ x: b.x, y: midY, w: b.w, h: 10 }, [6, 5], 40);
    const codeH = 104;
    s.code("CREATE INDEX orders_created_kst_date_idx ON orders\n  (((created_at AT TIME ZONE 'Asia/Seoul')::date));\n\nWHERE (created_at AT TIME ZONE 'Asia/Seoul')::date = '2026-07-01'", cl.x, midY, cl.w, codeH, { size: 15 });
    s.label("Buffers의 구성 (파랑 인덱스, 회색 테이블)", cr.x, midY - 4, cr.w, { size: 17 });
    const labelW = 160;
    const totalW = 64;
    const barW = cr.w - labelW - totalW;
    const rowsData = [
      { label: "created_at 인덱스", total: "= 102", parts: [[30, "30", "info"], [72, "72", "muted"]] },
      { label: "표현식 인덱스", total: "= 83", parts: [[11, "11", "info"], [72, "72", "muted"]] },
    ];
    rowsData.forEach((row, i) => {
      const y = midY + 28 + i * 40;
      s.text(row.label, cr.x, y + 7, labelW - 12, { size: 16, color: s.C.ink, align: "right" });
      let x = cr.x + labelW;
      for (const [v, text, tone] of row.parts) {
        const w = Math.round((v / 102) * barW);
        const t = s.theme.tones[tone];
        s.rect(x, y, w, 32, { fill: t.fill, stroke: t.stroke, strokeWidth: 2, radius: 4, hint: "part" });
        s.text(text, x, y + 7, w, { size: 15, align: "center", color: t.title });
        x += w;
      }
      s.text(row.total, x + 10, y + 6, totalW - 10, { size: 17, color: s.C.ink });
    });
    s.note("테이블 접근은 같다. 표현식 인덱스는 같은 날짜의 TID를 묶어 묶음마다 키를 한 번만 적으므로 크기가 3분의 1쯤이고 읽는 리프도 적다.", cr.x, midY + 112, cr.w, { size: 15 });
    const cols = s.cols({ x: b.x, y: cardsY, w: b.w, h: optH }, 2, 40);
    options.forEach((o, i) => s.card(cols[i], o));
  }),
];
