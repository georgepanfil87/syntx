#!/usr/bin/env sh

set -e

echo "[backend] waiting for database..."

until nc -z syntx-postgres 5432; do
  sleep 1
done

echo "[backend] running migrations..."
alembic upgrade head

echo "[backend] starting api..."

exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --reload