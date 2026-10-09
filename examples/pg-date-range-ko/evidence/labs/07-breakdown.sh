#!/bin/sh
# Pages read from the index and from the table for each query, from pg_statio counters.
set -eu
P="docker exec -i es-example-pg18 psql -U postgres -X -q -t -A"
count() {
  $P -c "SELECT pg_stat_reset();" >/dev/null
  $P -c "SET TIME ZONE 'Asia/Seoul'; SET max_parallel_workers_per_gather = 0; $1" >/dev/null
  $P -F ' ' -c "SELECT 'table', heap_blks_hit + heap_blks_read FROM pg_statio_user_tables WHERE relname = 'orders' UNION ALL SELECT 'index ' || indexrelname, idx_blks_hit + idx_blks_read FROM pg_statio_user_indexes WHERE relname = 'orders' AND idx_blks_hit + idx_blks_read > 0;"
}
$P -c "CREATE INDEX IF NOT EXISTS orders_created_kst_date_idx ON orders (((created_at AT TIME ZONE 'Asia/Seoul')::date)); ANALYZE orders;" >/dev/null
echo "== index sizes"
$P -F ' ' -c "SELECT relname, relpages, pg_size_pretty(pg_relation_size(oid)) FROM pg_class WHERE relname IN ('orders_created_at_idx', 'orders_created_kst_date_idx') ORDER BY relname;"
echo "== range condition"
count "SELECT sum(amount) FROM orders WHERE created_at >= '2026-07-01 00:00:00+09' AND created_at < '2026-07-02 00:00:00+09';"
echo "== expression index"
count "SELECT sum(amount) FROM orders WHERE (created_at AT TIME ZONE 'Asia/Seoul')::date = '2026-07-01';"
$P -c "DROP INDEX orders_created_kst_date_idx;" >/dev/null
