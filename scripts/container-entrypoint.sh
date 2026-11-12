#!/bin/sh
set -eu

python -c "from app.config import validate_runtime_configuration; validate_runtime_configuration()"
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips="${FORWARDED_ALLOW_IPS:-127.0.0.1}"
