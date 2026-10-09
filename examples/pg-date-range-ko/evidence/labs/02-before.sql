-- The slow query: a function on the column.
SET TIME ZONE 'Asia/Seoul';
SET max_parallel_workers_per_gather = 0;  -- one process, so the plan is easier to read
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT sum(amount) FROM orders WHERE date(created_at) = '2026-07-01';
