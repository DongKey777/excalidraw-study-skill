-- What AT TIME ZONE returns, and which function each cast to date calls.
SET TIME ZONE 'UTC';
SELECT timestamptz '2026-06-30 15:30:00+00' AT TIME ZONE 'Asia/Seoul' AS seoul_wall_clock,
       pg_typeof(timestamptz '2026-06-30 15:30:00+00' AT TIME ZONE 'Asia/Seoul') AS result_type;
SELECT c.castsource::regtype AS source, c.casttarget::regtype AS target,
       c.castfunc::regprocedure AS function, p.provolatile AS volatility
FROM pg_cast c JOIN pg_proc p ON p.oid = c.castfunc
WHERE c.castsource IN ('timestamp with time zone'::regtype, 'timestamp without time zone'::regtype)
  AND c.casttarget = 'date'::regtype
ORDER BY 1;
\set ON_ERROR_STOP 0
CREATE INDEX orders_created_cast_idx ON orders ((created_at::date));
\set ON_ERROR_STOP 1
