#!/bin/sh
set -e

echo "Running Alembic migrations..."
cd /app
python -m alembic upgrade head

echo "Starting FastAPI server..."
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8082
