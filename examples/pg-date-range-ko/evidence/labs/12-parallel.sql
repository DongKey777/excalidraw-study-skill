-- The slow query with the default parallel setting (02-before turns parallel workers off).
SET TIME ZONE 'Asia/Seoul';
SHOW max_parallel_workers_per_gather;
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)
SELECT sum(amount) FROM orders WHERE date(created_at) = '2026-07-01';
