-- The same rows in a scattered order: how many table pages a plain Index Scan touches then.
SET TIME ZONE 'Asia/Seoul';
SET max_parallel_workers_per_gather = 0;
CREATE TABLE orders_shuffled AS SELECT * FROM orders ORDER BY md5(id::text);
CREATE INDEX orders_shuffled_created_at_idx ON orders_shuffled (created_at);
VACUUM ANALYZE orders_shuffled;
SELECT tablename, correlation FROM pg_stats
WHERE tablename IN ('orders', 'orders_shuffled') AND attname = 'created_at' ORDER BY tablename;
SELECT count(*) AS july_1_rows, count(DISTINCT (ctid::text::point)[0]) AS table_pages
FROM orders_shuffled
WHERE created_at >= '2026-07-01 00:00:00+09' AND created_at < '2026-07-02 00:00:00+09';
-- The planner's own choice
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT sum(amount) FROM orders_shuffled
WHERE created_at >= '2026-07-01 00:00:00+09' AND created_at < '2026-07-02 00:00:00+09';
-- A plain Index Scan, as on orders
SET enable_bitmapscan = off;
SET enable_seqscan = off;
EXPLAIN (COSTS OFF)
SELECT sum(amount) FROM orders_shuffled
WHERE created_at >= '2026-07-01 00:00:00+09' AND created_at < '2026-07-02 00:00:00+09';
SELECT pg_stat_force_next_flush();
SELECT pg_stat_reset();
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT sum(amount) FROM orders_shuffled
WHERE created_at >= '2026-07-01 00:00:00+09' AND created_at < '2026-07-02 00:00:00+09';
SELECT pg_stat_force_next_flush();
SELECT 'table' AS relation, heap_blks_hit + heap_blks_read AS accesses FROM pg_statio_user_tables WHERE relname = 'orders_shuffled'
UNION ALL
SELECT 'index', idx_blks_hit + idx_blks_read FROM pg_statio_user_indexes WHERE relname = 'orders_shuffled';
SELECT sum(amount) AS by_range FROM orders_shuffled
WHERE created_at >= '2026-07-01 00:00:00+09' AND created_at < '2026-07-02 00:00:00+09';
DROP TABLE orders_shuffled;
