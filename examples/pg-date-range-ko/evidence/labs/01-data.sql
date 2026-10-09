-- 1,000,000 orders, one every 9 seconds from 2026-06-01 00:00 KST (about 9,600 a day).
-- Values are derived from g so every run produces the same table.
SELECT version();
DROP TABLE IF EXISTS orders;
CREATE TABLE orders (
  id          bigserial PRIMARY KEY,
  customer_id int         NOT NULL,
  created_at  timestamptz NOT NULL,
  amount      int         NOT NULL
);
INSERT INTO orders (customer_id, created_at, amount)
SELECT g % 10000,
       timestamptz '2026-06-01 00:00:00+09' + g * interval '9 seconds',
       ((g::bigint * 7919) % 100000)::int
FROM generate_series(0, 999999) AS g;
CREATE INDEX orders_created_at_idx ON orders (created_at);
VACUUM ANALYZE orders;
SELECT count(*) AS orders, min(created_at) AS first_order, max(created_at) AS last_order FROM orders;
SELECT pg_size_pretty(pg_relation_size('orders')) AS table_size,
       pg_size_pretty(pg_relation_size('orders_created_at_idx')) AS index_size,
       relpages AS table_pages
FROM pg_class WHERE relname = 'orders';
