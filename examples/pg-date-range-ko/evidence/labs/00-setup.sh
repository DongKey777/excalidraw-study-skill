#!/bin/sh
# Local PostgreSQL 18 for the experiments. Separate container name and port.
set -eu
docker run --rm -d --name es-example-pg18 -p 127.0.0.1:55499:5432 -e POSTGRES_PASSWORD=pw postgres:18
until docker exec es-example-pg18 pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
docker exec -i es-example-pg18 psql -U postgres -v ON_ERROR_STOP=1 -X < 01-data.sql > 01-data.out.txt 2>&1
