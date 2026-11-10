# syntax=docker/dockerfile:1
FROM python:3.12-slim
WORKDIR /app
COPY --chown=10001:10001 backend /app/backend
COPY --chown=10001:10001 assets /app/assets
COPY --chown=10001:10001 index.html /app/index.html
RUN --mount=type=secret,id=proxy_ca \
    useradd --uid 10001 --create-home store && \
    if [ -f /run/secrets/proxy_ca ]; then PIP_CERT=/run/secrets/proxy_ca pip install --no-cache-dir -r backend/requirements.txt; \
    else pip install --no-cache-dir -r backend/requirements.txt; fi
ENV PYTHONPATH=/app/backend PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
USER store
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
