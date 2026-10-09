-- How many table pages hold the July 1 rows, and how many levels the created_at index has.
SET TIME ZONE 'Asia/Seoul';
SELECT count(*) AS july_1_rows,
       count(DISTINCT (ctid::text::point)[0]) AS table_pages,
       min((ctid::text::point)[0])::int AS first_page,
       max((ctid::text::point)[0])::int AS last_page
FROM orders
WHERE created_at >= '2026-07-01 00:00:00+09' AND created_at < '2026-07-02 00:00:00+09';
-- The first and last page also hold rows of June 30 and July 2.
SELECT (ctid::text::point)[0]::int AS page, min(created_at) AS first_row, max(created_at) AS last_row, count(*) AS rows
FROM orders
WHERE (ctid::text::point)[0] IN (2117, 2188)
GROUP BY 1 ORDER BY 1;
-- Rows were inserted in created_at order.
SELECT attname, correlation FROM pg_stats WHERE tablename = 'orders' AND attname = 'created_at';
CREATE EXTENSION pageinspect;
SELECT level AS root_level FROM bt_metap('orders_created_at_idx');
SELECT CASE type WHEN 'r' THEN 'root' WHEN 'i' THEN 'internal' WHEN 'l' THEN 'leaf' END AS page_type, count(*) AS pages
FROM bt_multi_page_stats('orders_created_at_idx', 1, -1)
GROUP BY type ORDER BY min(blkno);
DROP EXTENSION pageinspect;
