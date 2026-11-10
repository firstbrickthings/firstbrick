# syntax=docker/dockerfile:1
FROM python:3.12-slim
WORKDIR /app
COPY --chown=10001:10001 backend /app/backend
COPY --chown=10001:10001 assets /app/assets
COPY --chown=10001:10001 index.html /app/index.html
RUN useradd --uid 10001 --create-home store && pip install --no-cache-dir -r backend/requirements.txt
ENV PYTHONPATH=/app/backend PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
USER store
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
