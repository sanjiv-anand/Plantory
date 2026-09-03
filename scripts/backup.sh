#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

read_env() {
  local key="$1"
  local default="$2"
  if [[ -f .env ]]; then
    local value
    value="$(grep -E "^${key}=" .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
    if [[ -n "$value" ]]; then
      printf '%s' "$value"
      return
    fi
  fi
  printf '%s' "$default"
}

COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$(read_env COMPOSE_PROJECT_NAME lilylog)}"
POSTGRES_DB="${POSTGRES_DB:-$(read_env POSTGRES_DB lilylog)}"
POSTGRES_USER="${POSTGRES_USER:-$(read_env POSTGRES_USER postgres)}"
BACKUP_DIR="${BACKUP_HOST_DIR:-${BACKUP_DIR:-$HOME/lilylog-backups}}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
PHOTOS_VOLUME="${COMPOSE_PROJECT_NAME}_photos_data"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"

if ! docker compose ps --status running --services 2>/dev/null | grep -qx postgres; then
  echo "postgres service is not running; start the stack with: docker compose up -d" >&2
  exit 1
fi

if ! docker volume inspect "$PHOTOS_VOLUME" >/dev/null 2>&1; then
  echo "photos volume not found: $PHOTOS_VOLUME" >&2
  echo "Check COMPOSE_PROJECT_NAME in .env or run: docker volume ls | grep photos" >&2
  exit 1
fi

echo "Backing up database to ${BACKUP_DIR}/lilylog_${TIMESTAMP}.sql"
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  > "${BACKUP_DIR}/lilylog_${TIMESTAMP}.sql"

echo "Backing up photos to ${BACKUP_DIR}/photos_${TIMESTAMP}.tar.gz"
docker run --rm \
  -v "${PHOTOS_VOLUME}:/data:ro" \
  -v "${BACKUP_DIR}:/backup" \
  alpine tar czf "/backup/photos_${TIMESTAMP}.tar.gz" -C /data .

if [[ "$RETENTION_DAYS" -gt 0 ]]; then
  echo "Removing backups older than ${RETENTION_DAYS} days"
  find "$BACKUP_DIR" -type f \( -name 'lilylog_*.sql' -o -name 'photos_*.tar.gz' \) \
    -mtime +"$RETENTION_DAYS" -delete
fi

echo "$(date -Iseconds) backup complete: lilylog_${TIMESTAMP}"
