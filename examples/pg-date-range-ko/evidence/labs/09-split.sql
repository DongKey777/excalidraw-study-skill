-- Buffers split two ways: by cache state (hit/read) and by relation (table/index).
-- One session, so the planner reuses cached index metadata and reads no index page while planning.
-- pg_stat_force_next_flush() makes this session's counters visible before the next statement.
CREATE EXTENSION pg_prewarm;
CREATE EXTENSION pg_buffercache;
SET TIME ZONE 'Asia/Seoul';
SET max_parallel_workers_per_gather = 0;
EXPLAIN (COSTS OFF)
SELECT sum(amount) FROM orders
WHERE created_at >= '2026-07-01 00:00:00+09' AND created_at < '2026-07-02 00:00:00+09';

-- 1) Table pages in shared buffers, index pages not (the state 03-after ran in)
SELECT pg_prewarm('orders') AS table_pages_loaded;
SELECT buffers_evicted FROM pg_buffercache_evict_relation('orders_created_at_idx');
SELECT pg_stat_force_next_flush();
SELECT pg_stat_reset();
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT sum(amount) FROM orders
WHERE created_at >= '2026-07-01 00:00:00+09' AND created_at < '2026-07-02 00:00:00+09';
SELECT pg_stat_force_next_flush();
SELECT 'table' AS relation, heap_blks_hit AS hit, heap_blks_read AS read FROM pg_statio_user_tables WHERE relname = 'orders'
UNION ALL
SELECT indexrelname, idx_blks_hit, idx_blks_read FROM pg_statio_user_indexes WHERE relname = 'orders' AND idx_blks_hit + idx_blks_read > 0;

-- 2) The same query again: every page it needs is now in shared buffers
SELECT pg_stat_force_next_flush();
SELECT pg_stat_reset();
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT sum(amount) FROM orders
WHERE created_at >= '2026-07-01 00:00:00+09' AND created_at < '2026-07-02 00:00:00+09';
SELECT pg_stat_force_next_flush();
SELECT 'table' AS relation, heap_blks_hit AS hit, heap_blks_read AS read FROM pg_statio_user_tables WHERE relname = 'orders'
UNION ALL
SELECT indexrelname, idx_blks_hit, idx_blks_read FROM pg_statio_user_indexes WHERE relname = 'orders' AND idx_blks_hit + idx_blks_read > 0;

-- 3) The expression index from 04-volatility, split the same way
CREATE INDEX orders_created_kst_date_idx ON orders (((created_at AT TIME ZONE 'Asia/Seoul')::date));
ANALYZE orders;
EXPLAIN (COSTS OFF)
SELECT sum(amount) FROM orders WHERE (created_at AT TIME ZONE 'Asia/Seoul')::date = '2026-07-01';
SELECT pg_stat_force_next_flush();
SELECT pg_stat_reset();
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT sum(amount) FROM orders WHERE (created_at AT TIME ZONE 'Asia/Seoul')::date = '2026-07-01';
SELECT pg_stat_force_next_flush();
SELECT 'table' AS relation, heap_blks_hit AS hit, heap_blks_read AS read FROM pg_statio_user_tables WHERE relname = 'orders'
UNION ALL
SELECT indexrelname, idx_blks_hit, idx_blks_read FROM pg_statio_user_indexes WHERE relname = 'orders' AND idx_blks_hit + idx_blks_read > 0;
DROP INDEX orders_created_kst_date_idx;
DROP EXTENSION pg_buffercache;
DROP EXTENSION pg_prewarm;
