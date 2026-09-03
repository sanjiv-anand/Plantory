FROM node:22-alpine AS frontend-build
WORKDIR /frontend

ARG VITE_API_URL=/api
ARG VITE_MEDIA_URL=
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_MEDIA_URL=${VITE_MEDIA_URL}

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    STATIC_DIR=/app/static

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev gcc postgresql-client && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend-build /frontend/dist /app/static

EXPOSE 8000

CMD ["sh", "-c", "python -m app.start && python -m scripts.wait_for_db && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
