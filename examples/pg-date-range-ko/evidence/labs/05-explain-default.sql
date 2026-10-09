-- PostgreSQL 18: EXPLAIN ANALYZE prints buffer counts without asking for BUFFERS.
SET max_parallel_workers_per_gather = 0;
SHOW block_size;
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF)
SELECT count(*) FROM orders WHERE id < 1000;
