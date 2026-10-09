# 근거 목록

슬라이드에 들어가는 사실과 숫자를 여기에 먼저 적는다. 상태가 확인, 실측, 문서, 계산인 항목만 슬라이드의 `claims`에 쓸 수 있다.

| id | 주장 | 값 | 근거 (파일·줄, 링크, 실험) | 기준 시점 | 상태 |
|---|---|---|---|---|---|
| C1 | 예제 주문 테이블은 100만 행이고 9초마다 1건씩 시간 순서로 넣었다 | 1,000,000행, 9초마다 1건, 하루 9,600건 | labs/01-data.sql, 01-data.out.txt | 2026-09-30 | 실측 |
| C2 | 테이블은 7,353페이지다 | 7,353페이지, 57MB | labs/01-data.out.txt (relpages, pg_relation_size) | 2026-09-30 | 실측 |
| C3 | `date(created_at) = '2026-07-01'`은 Seq Scan으로 읽고 Filter로 990,400행을 버렸다 | rows 9,600, Rows Removed by Filter 990,400 | labs/02-before.out.txt | 2026-09-30 | 실측 |
| C4 | 그때 접근한 페이지는 테이블 전체다 | Buffers: shared hit=7353 | labs/02-before.out.txt | 2026-09-30 | 실측 |
| C5 | 반열린 범위 조건은 Index Scan과 Index Cond로 읽었고 인덱스를 한 번 내려갔다 | Index Cond, Index Searches: 1 | labs/03-after.out.txt | 2026-09-30 | 실측 |
| C6 | 그때 Buffers 합계는 102다 | shared hit=72 read=30 | labs/03-after.out.txt | 2026-09-30 | 실측 |
| C7 | 세션 시간대가 Asia/Seoul일 때 두 쿼리의 결과는 같다 | sum 480008800 | labs/03-after.out.txt (SET TIME ZONE 'Asia/Seoul') | 2026-09-30 | 실측 |
| C8 | 실행 시간은 병렬 실행을 끈 한 번의 측정값으로 약 55ms와 약 1ms다 | 54.894ms, 1.093ms | labs/02-before.out.txt (모두 hit), 03-after.out.txt (hit 72, read 30). 두 SQL 모두 `max_parallel_workers_per_gather = 0` | 2026-09-30 | 실측 |
| C9 | `date(timestamptz)`는 STABLE이고 `timezone(text, timestamptz)`와 `date(timestamp)`는 IMMUTABLE이다 | provolatile s, i, i | labs/04-volatility.out.txt | 2026-09-30 | 실측 |
| C10 | `date(created_at)`으로 인덱스를 만들면 오류가 난다 | functions in index expression must be marked IMMUTABLE | labs/04-volatility.out.txt | 2026-09-30 | 실측 |
| C11 | `(created_at AT TIME ZONE 'Asia/Seoul')::date` 표현식 인덱스는 만들어지고 같은 식의 조건을 Index Cond로 읽는다 | Buffers 83 (hit 72, read 11) | labs/04-volatility.out.txt | 2026-09-30 | 실측 |
| C12 | PostgreSQL 18의 EXPLAIN ANALYZE는 BUFFERS를 따로 켜지 않아도 Buffers 줄을 보여 준다 | Buffers 줄 출력 | labs/05-explain-default.out.txt, 근거 §6 ("Automatically include BUFFERS output in EXPLAIN ANALYZE") | 2026-09-30 | 실측 |
| C13 | 페이지 하나는 8kB다 | block_size 8192 | labs/05-explain-default.out.txt | 2026-09-30 | 실측 |
| C14 | Buffers는 페이지 접근 횟수다(같은 페이지에 두 번 접근하면 두 번 센다). hit는 공유 버퍼에서 찾아 읽기를 피한 것이고 read는 공유 버퍼 밖에서 가져온 것이라 접근 한 번은 둘 중 하나로 센다. 그 페이지가 OS 캐시에 있었는지는 EXPLAIN에 나오지 않는다 | "non-distinct buffers", "A hit means that a read was avoided because the block was found already in cache" | 근거 §2 (using-explain, sql-explain). labs/09-split.out.txt에서 같은 쿼리의 hit+read가 두 번 모두 102 | PostgreSQL 18 | 문서 |
| C15 | B-tree의 리프 페이지는 키 순서로 정렬되고 같은 층의 이웃 페이지와 양방향으로 이어진다. 리프의 항목은 테이블 행을 가리킨다(TID) | "each level of the tree can be used as a doubly-linked list of pages", "Each leaf page contains tuples that point to table rows" | 근거 §3 | PostgreSQL 18 | 문서 |
| C16 | STABLE 함수는 SQL 문 하나 안에서는 같은 결과를 내지만 TimeZone 같은 설정에 따라 달라질 수 있다. 인덱스 정의에는 IMMUTABLE 함수만 쓸 수 있다 | | 근거 §4, §7 | PostgreSQL 18 | 문서 |
| C17 | 필요한 행은 전체의 약 1%다 | 9,600 / 1,000,000 = 0.96% | C1, C3에서 계산 | 2026-09-30 | 계산 |
| C18 | created_at 인덱스는 2,745페이지다 | 2,745페이지, 21MB | labs/06-timezone.out.txt, 07-breakdown.out.txt | 2026-09-30 | 실측 |
| C19 | B-tree 인덱스는 인덱스에 저장한 열이나 식이 비교 조건에 그대로 나올 때 쓰인다. 표현식 인덱스는 쿼리가 같은 식을 쓸 때 쓰인다. 이 실험에서 date(created_at) 조건은 created_at 범위로 바뀌지 않고 Filter에 남았다 | | 근거 §5, §8, labs/02-before.out.txt | PostgreSQL 18 | 문서 |
| C20 | 같은 시각 2026-06-30 15:30 UTC가 세션 시간대 Asia/Seoul에서는 7월 1일, UTC에서는 6월 30일이 된다 | 2026-07-01 / 2026-06-30 | labs/06-timezone.out.txt | 2026-09-30 | 실측 |
| C21 | 7월 1일(KST) 행 9,600개는 테이블 2117~2188번, 72페이지에 들어 있다. 첫 페이지와 마지막 페이지는 6월 30일·7월 2일 행과 같이 쓴다. 행을 시간 순서로 넣어 created_at의 correlation은 1이다 | 72페이지, 2117~2188, correlation 1 | labs/08-pages.out.txt (ctid로 센 페이지 수, 경계 페이지의 첫 행·끝 행, pg_stats) | 2026-10-08 | 실측 |
| C22 | 인덱스 리프 하나에 약 370개 키가 들어가므로 하루치는 리프 수십 개에 걸친다 | 1,000,000 / 2,733 ≈ 366, 9,600 / 366 ≈ 26 | C1, C38에서 계산 | 2026-10-08 | 계산 |
| C23 | 범위 조건의 Buffers 102는 테이블 접근 72와 인덱스 접근 30이다 | table 72, orders_created_at_idx 30 | labs/09-split.out.txt (한 세션에서 계획 단계의 인덱스 접근 없이 pg_statio로 셈) | 2026-10-08 | 실측 |
| C24 | 날짜 표현식 인덱스는 852페이지로 created_at 인덱스(2,745페이지)보다 작다. 같은 날짜 키를 가진 TID를 여러 개씩 posting list로 묶고 묶음마다 키를 한 번만 적기 때문이다(deduplication) | 852 / 2,745페이지 | labs/07-breakdown.out.txt, 근거 §3 ("forming a single posting list tuple for each group. The column key value(s) only appear once") | 2026-09-30 | 실측 |
| C25 | 표현식 인덱스 쿼리의 Buffers 83은 테이블 접근 72와 인덱스 접근 11이다 | table 72, orders_created_kst_date_idx 11 | labs/09-split.out.txt | 2026-10-08 | 실측 |
| C26 | timestamptz는 시각을 UTC로 저장한다. 화면에 보여 줄 때와 date()로 날짜를 꺼낼 때 세션 시간대로 바꾼다 | | 근거 §9, labs/06-timezone.out.txt | PostgreSQL 18 | 문서 |
| C27 | 표현식 인덱스는 행을 넣거나 HOT이 아닌 UPDATE를 할 때마다 식을 계산해 갱신한다. 인덱스가 하나 늘면 그만큼 갱신할 인덱스도 는다 | "must be computed for each row insertion and non-HOT update" | 근거 §5 | PostgreSQL 18 | 문서 |
| C28 | 범위 조건의 테이블 접근 72는 7월 1일 행이 든 페이지 수(72)와 같다. 이어지는 TID가 같은 페이지를 가리키면 그 페이지를 다시 읽지 않는다. 같은 행을 순서를 섞어 복사한 테이블에서는 같은 Index Scan이 테이블에 9,598번 접근했다 | 72 = 72페이지, 섞은 사본 table 9,598 + index 30 = Buffers 9,628 | labs/08-pages.out.txt, 09-split.out.txt, 10-shuffled.out.txt (correlation 약 0, 9,600행이 5,382페이지에 흩어짐) | 2026-10-08 | 실측 |
| C29 | `timestamptz AT TIME ZONE 'Asia/Seoul'`은 `timezone(text, timestamptz)`와 같고 결과는 시간대 없는 timestamp(서울 시각)다 | 2026-07-01 00:30:00, timestamp without time zone | labs/11-cast.out.txt (UTC 세션), 근거 §10 ("timezone(zone, timestamp) is equivalent to the SQL-conforming construct timestamp AT TIME ZONE zone") | 2026-10-08 | 실측 |
| C30 | `::date`는 date로 형 변환한다. timestamp에서는 `date(timestamp)`(IMMUTABLE)를, timestamptz에서는 `date(timestamptz)`(STABLE)를 부른다. `created_at::date`로 인덱스를 만들어도 같은 오류가 난다 | pg_cast castfunc i / s, ERROR | labs/11-cast.out.txt | 2026-10-08 | 실측 |
| C31 | rows는 노드를 한 번 실행할 때의 평균이다. PostgreSQL 18부터 소수로 나온다. 병렬 계획에서는 rows=3200.00 loops=3이 실행 세 번의 평균이다 | "the actual time and rows values shown are averages per-execution", "Modify EXPLAIN to output fractional row counts" | 근거 §2, §6, labs/12-parallel.out.txt | PostgreSQL 18 | 문서 |
| C32 | 위 노드의 Buffers는 아래 노드의 접근을 포함한다 | "The number of blocks shown for an upper-level node includes those used by all its child nodes" | 근거 §2 (sql-explain), labs/02-before.out.txt (Aggregate와 Seq Scan 모두 7353) | PostgreSQL 18 | 문서 |
| C33 | 병렬 실행을 끄지 않으면 같은 쿼리가 Gather 아래 Parallel Seq Scan으로 나오고 Buffers 합은 7,353으로 같다 | Workers Launched: 2, Buffers: shared hit=7353 | labs/12-parallel.out.txt | 2026-10-08 | 실측 |
| C34 | Index Cond는 인덱스 안에서 검사하는 조건이다. 인덱스로 검사할 수 없는 조건은 인덱스로 가져온 행에 Filter로 건다. 범위 조건은 시작 값으로 리프를 찾고 끝 값에서 멈추므로 하루치에 인덱스 2,745페이지 중 30페이지만 접근했다 | "find the locations of rows matching the index condition", "applied as a filter on the rows retrieved using the index" | 근거 §2 (using-explain), labs/09-split.out.txt | PostgreSQL 18 | 문서 |
| C35 | hit·read 나눔과 테이블·인덱스 나눔은 기준이 다르다. 인덱스 페이지만 공유 버퍼에서 뺀 상태에서는 hit=72 read=30(테이블 hit 72, 인덱스 read 30)이고 바로 다시 돌리면 hit=102(테이블 hit 72, 인덱스 hit 30)다 | hit=72 read=30 → hit=102 | labs/09-split.out.txt (pg_prewarm, pg_buffercache_evict_relation) | 2026-10-08 | 실측 |
| C36 | date() 조건 쿼리는 디스크 읽기 없이(모두 hit) 약 55ms가 걸렸고 그 시간 대부분은 100만 행을 확인한 Seq Scan 노드에서 썼다 | shared hit=7353, Seq Scan actual time 19.151..54.570, Rows Removed 990,400 | labs/02-before.out.txt | 2026-09-30 | 실측 |
| C37 | Index Searches는 Index Scan 노드가 인덱스를 찾아 내려간 횟수다 | "report the number of index lookups used per index scan node" | 근거 §6, labs/03-after.out.txt (Index Searches: 1) | PostgreSQL 18 | 문서 |
| C38 | created_at 인덱스는 루트 1, 내부 페이지 10, 리프 2,733의 3층이다 | root_level 2, root 1, internal 10, leaf 2,733 | labs/08-pages.out.txt (pageinspect) | 2026-10-08 | 실측 |
| C39 | 표현식 인덱스의 크기는 created_at 인덱스의 3분의 1쯤이다 | 852 / 2,745 = 0.31 | C18, C24에서 계산 | 2026-10-08 | 계산 |
| C40 | 2장 그림에서 칸 하나는 약 73.5페이지이고 7월 1일 행(2117~2188번)은 29번째 칸의 끝과 30번째 칸의 앞쪽에 걸친다 | 7,353 / 100 = 73.53, 2117 / 73.53 = 28.8, 2189 / 73.53 = 29.8 | C2, C21에서 계산 | 2026-10-08 | 계산 |
| C41 | Index Scan은 리프에서 찾은 TID로 테이블 행을 인덱스 순서대로 가져온다 | "the table rows are fetched in index order" | 근거 §2 (using-explain), §3 | PostgreSQL 18 | 문서 |
| C42 | 행 순서를 섞은 사본에서는 플래너가 같은 범위 조건에 Bitmap Heap Scan을 골랐다 | Heap Blocks: exact=5382, Buffers: shared hit=5412 | labs/10-shuffled.out.txt | 2026-10-08 | 실측 |
