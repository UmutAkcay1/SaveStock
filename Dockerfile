FROM python:3.12-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /build
COPY requirements.txt .
COPY requirements.lock.txt .
RUN python -m pip install --upgrade pip \
    && python -m pip wheel --wheel-dir /wheels -r requirements.lock.txt

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system savestock \
    && useradd --system --gid savestock --create-home savestock
WORKDIR /app
COPY --from=builder /wheels /wheels
COPY requirements.lock.txt .
RUN python -m pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.lock.txt \
    && rm -rf /wheels
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini .
COPY scripts/container-entrypoint.sh ./scripts/container-entrypoint.sh
RUN mkdir -p /backups && chown -R savestock:savestock /app /backups
USER savestock
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import os, urllib.request; host=os.getenv('SAVESTOCK_ALLOWED_HOSTS', 'localhost').split(',')[0].strip(); request=urllib.request.Request('http://127.0.0.1:8000/api/health/ready', headers={'Host': host}); urllib.request.urlopen(request, timeout=3)" || exit 1
ENTRYPOINT ["sh", "scripts/container-entrypoint.sh"]
