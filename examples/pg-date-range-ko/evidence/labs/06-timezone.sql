-- One instant, two session time zones, two dates.
SET TIME ZONE 'Asia/Seoul';
SELECT timestamptz '2026-06-30 15:30:00+00' AS instant, date(timestamptz '2026-06-30 15:30:00+00') AS date_in_session;
SET TIME ZONE 'UTC';
SELECT timestamptz '2026-06-30 15:30:00+00' AS instant, date(timestamptz '2026-06-30 15:30:00+00') AS date_in_session;
SELECT (timestamptz '2026-06-30 15:30:00+00' AT TIME ZONE 'Asia/Seoul')::date AS kst_date_any_session;
SELECT pg_size_pretty(pg_relation_size('orders_created_at_idx')) AS index_size,
       relpages AS index_pages
FROM pg_class WHERE relname = 'orders_created_at_idx';
