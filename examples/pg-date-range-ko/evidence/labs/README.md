# 로컬 실험

동작에 대한 주장은 로컬에서 재현해 확인했다. 실험마다 입력과 출력을 짝으로 둔다.

- 버전: PostgreSQL 18.6 (Docker `postgres:18`, aarch64)
- 컨테이너 `es-example-pg18`, 포트 127.0.0.1:55499
- 출력은 psql 결과를 그대로 저장했다. 실행 시간과 계획 단계(Planning)의 Buffers는 실행할 때마다 조금씩 달라진다.
- 02~07의 출력은 2026-09-30에 저장했다. 01과 08~12의 출력은 2026-10-08에 새 컨테이너에서 아래 순서대로 처음부터 돌려 저장했다. 그때 02~07도 다시 돌렸고 실행 시간과 계획 단계 Buffers를 빼면 저장된 출력과 같았다.
- 08, 09는 PostgreSQL에 함께 들어 있는 확장(pageinspect, pg_prewarm, pg_buffercache)을 만들었다가 지운다. 09의 `pg_buffercache_evict_relation()`은 PostgreSQL 18에서 생긴 함수다.

| 실험 | 준비 | 실행 | 출력 | 확인한 주장 | 자료를 바꾸나 |
|---|---|---|---|---|---|
| 01 데이터 | `00-setup.sh` | `01-data.sql` | `01-data.out.txt` | C1, C2 | 아니다 |
| 02 함수 조건 | 01 | `02-before.sql` | `02-before.out.txt` | C3, C4, C8, C32, C36 | 아니다 |
| 03 범위 조건 | 01 | `03-after.sql` | `03-after.out.txt` | C5, C6, C7, C8, C37 | 아니다 |
| 04 변동성과 표현식 인덱스 | 01 | `04-volatility.sql` | `04-volatility.out.txt` | C9, C10, C11 | 표현식 인덱스를 대안으로 넣었다 |
| 05 BUFFERS 기본값 | 01 | `05-explain-default.sql` | `05-explain-default.out.txt` | C12, C13 | 아니다 |
| 06 시간대와 날짜 | 01 | `06-timezone.sql` | `06-timezone.out.txt` | C18, C20, C26 | 시간대 장의 예시 시각을 정했다 |
| 07 인덱스와 테이블 페이지 | 01 | `07-breakdown.sh` | `07-breakdown.out.txt` | C18, C24 | 감사 1차에서 102와 83의 차이를 설명하라는 지적을 받고 추가했다. pg_statio를 psql 호출마다 새 세션에서 읽어 계획 단계의 인덱스 접근 1이 더해진다(31, 12). 실행 단계만 센 값은 09에 있다 |
| 08 7월 1일 행의 페이지와 인덱스 층 | 01 | `08-pages.sql` | `08-pages.out.txt` | C21, C28, C38 | 감사 3차 지적으로 추가했다. 어림값 '약 71페이지'를 ctid로 센 72페이지로 바꿨고 5장 그림의 테이블 페이지 번호를 정했다 |
| 09 Buffers를 두 기준으로 나누기 | 01 | `09-split.sql` | `09-split.out.txt` | C14, C23, C25, C34, C35 | 감사 3차 지적으로 추가했다. hit·read와 테이블·인덱스가 다른 기준이라는 것을 보이고, 102와 83의 구성(30, 11)을 계산 없이 바로 찍는다 |
| 10 행 순서를 섞은 사본 | 01 | `10-shuffled.sql` | `10-shuffled.out.txt` | C28, C42 | 감사 3차 지적으로 추가했다. 테이블 접근이 72번에 그친 이유를 보이려고 8장에 비교 막대를 넣었다 |
| 11 AT TIME ZONE과 형 변환 | 01 | `11-cast.sql` | `11-cast.out.txt` | C29, C30 | 감사 3차 지적으로 추가했다. 7장에 `created_at::date` 오류를, 9장에 식의 단계별 값을 넣었다 |
| 12 병렬 실행 기본값 | 01 | `12-parallel.sql` | `12-parallel.out.txt` | C31, C33 | 감사 3차 지적으로 추가했다. 3장에 병렬을 끈 이유와 기본 설정의 계획 모양을 적었다 |

다시 돌리는 법:

```sh
sh 00-setup.sh
for f in 02-before 03-after 04-volatility 05-explain-default 06-timezone; do
  docker exec -i es-example-pg18 psql -U postgres -X < $f.sql > $f.out.txt 2>&1
done
sh 07-breakdown.sh > 07-breakdown.out.txt
for f in 08-pages 09-split 10-shuffled 11-cast 12-parallel; do
  docker exec -i es-example-pg18 psql -U postgres -X < $f.sql > $f.out.txt 2>&1
done
docker stop es-example-pg18
```

09는 같은 세션 안에서 공유 버퍼 상태를 직접 정한다(테이블은 `pg_prewarm`으로 올리고 인덱스는 `pg_buffercache_evict_relation()`으로 뺀다). 그래서 앞 실험을 어떤 순서로 돌렸든 첫 실행은 hit=72 read=30, 두 번째 실행은 hit=102가 나온다. 10은 행 순서를 `md5(id::text)`로 섞으므로 다시 돌려도 같은 사본이 만들어진다. correlation 값만 ANALYZE 표본에 따라 0 근처에서 조금씩 달라진다.
