-- The same day as a half-open range on the raw column.
SET TIME ZONE 'Asia/Seoul';
SET max_parallel_workers_per_gather = 0;
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT sum(amount) FROM orders
WHERE created_at >= '2026-07-01 00:00:00+09' AND created_at < '2026-07-02 00:00:00+09';
SELECT sum(amount) AS by_function FROM orders WHERE date(created_at) = '2026-07-01';
SELECT sum(amount) AS by_range FROM orders
WHERE created_at >= '2026-07-01 00:00:00+09' AND created_at < '2026-07-02 00:00:00+09';
