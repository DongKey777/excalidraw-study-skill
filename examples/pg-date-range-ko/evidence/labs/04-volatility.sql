-- Why date(created_at) cannot be indexed, and which expression can.
SET TIME ZONE 'Asia/Seoul';
SET max_parallel_workers_per_gather = 0;
SELECT p.oid::regprocedure AS function, p.provolatile AS volatility
FROM pg_proc p
WHERE (p.proname = 'date' AND pg_get_function_identity_arguments(p.oid) = 'timestamp with time zone')
   OR (p.proname = 'timezone' AND pg_get_function_identity_arguments(p.oid) = 'text, timestamp with time zone')
   OR (p.proname = 'date' AND pg_get_function_identity_arguments(p.oid) = 'timestamp without time zone');
\set ON_ERROR_STOP 0
CREATE INDEX orders_created_date_idx ON orders (date(created_at));
\set ON_ERROR_STOP 1
CREATE INDEX orders_created_kst_date_idx ON orders (((created_at AT TIME ZONE 'Asia/Seoul')::date));
ANALYZE orders;
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT sum(amount) FROM orders WHERE (created_at AT TIME ZONE 'Asia/Seoul')::date = '2026-07-01';
DROP INDEX orders_created_kst_date_idx;
