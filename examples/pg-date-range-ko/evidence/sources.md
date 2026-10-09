# 근거 문서

슬라이드의 `source`는 이 표의 번호(§)로 가리킨다.

| § | 자료 | 위치 | 기준 시점 | 메모 |
|---|---|---|---|---|
| 1 | 로컬 실험 | `evidence/labs/` | 2026-09-30(02~07), 2026-10-08(01, 08~12), PostgreSQL 18.6 (Docker `postgres:18`) | 입력과 출력을 짝으로 둔다 |
| 2 | PostgreSQL 문서: Using EXPLAIN, EXPLAIN | https://www.postgresql.org/docs/18/using-explain.html, https://www.postgresql.org/docs/18/sql-explain.html | 18 | Buffers (hit, read, 위 노드는 아래 노드 포함), rows는 실행 한 번의 평균, Filter, Index Cond, Index Scan은 테이블 행을 인덱스 순서로 가져온다 |
| 3 | PostgreSQL 문서: B-Tree Indexes | https://www.postgresql.org/docs/18/btree.html | 18 | 리프는 테이블 행을 가리킨다, 층마다 이중 연결 목록, 중복 제거(posting list) |
| 4 | PostgreSQL 문서: Function Volatility Categories | https://www.postgresql.org/docs/18/xfunc-volatility.html | 18 | IMMUTABLE, STABLE |
| 5 | PostgreSQL 문서: Indexes on Expressions | https://www.postgresql.org/docs/18/indexes-expressional.html | 18 | 표현식 인덱스 |
| 6 | PostgreSQL 18 릴리스 노트 | https://www.postgresql.org/docs/18/release-18.html | 18 | EXPLAIN ANALYZE의 BUFFERS 기본값, Index Searches, 소수 행 수, pg_buffercache_evict_relation() |
| 7 | PostgreSQL 문서: CREATE INDEX | https://www.postgresql.org/docs/18/sql-createindex.html | 18 | 인덱스 정의의 함수는 IMMUTABLE이어야 한다 |
| 8 | PostgreSQL 문서: Index Types | https://www.postgresql.org/docs/18/indexes-types.html | 18 | 인덱스를 쓰는 조건의 모양 |
| 9 | PostgreSQL 문서: Date/Time Types | https://www.postgresql.org/docs/18/datatype-datetime.html | 18 | timestamptz는 UTC로 저장하고 세션 시간대로 보여 준다 |
| 10 | PostgreSQL 문서: Date/Time Functions and Operators (9.9.4 AT TIME ZONE) | https://www.postgresql.org/docs/18/functions-datetime.html | 18 | timezone(zone, timestamp)는 AT TIME ZONE과 같다, timestamptz AT TIME ZONE의 결과는 timestamp |
