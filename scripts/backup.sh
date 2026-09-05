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

COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$(read_env COMPOSE_PROJECT_NAME plantory)}"
POSTGRES_DB="${POSTGRES_DB:-$(read_env POSTGRES_DB plantory)}"
POSTGRES_USER="${POSTGRES_USER:-$(read_env POSTGRES_USER postgres)}"
BACKUP_DIR="${BACKUP_HOST_DIR:-${BACKUP_DIR:-$HOME/plantory-backups}}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
BACKUP_INCLUDE_MODELS="${BACKUP_INCLUDE_MODELS:-true}"
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

DB_FILE="${BACKUP_DIR}/plantory_${TIMESTAMP}.sql"
PHOTOS_FILE="${BACKUP_DIR}/photos_${TIMESTAMP}.tar.gz"
MODELS_FILE=""
MANIFEST_FILE="${BACKUP_DIR}/manifest_${TIMESTAMP}.json"

echo "Backing up database to ${DB_FILE}"
echo "  Includes: plants, journal entries, events, auth, AI settings, assistant memories,"
echo "             conversation summaries, chat history, plant story cache"
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$DB_FILE"

echo "Backing up photos to ${PHOTOS_FILE}"
echo "  Includes: plant photos, assistant log placeholders (assistant/placeholder.jpg)"
docker run --rm \
  -v "${PHOTOS_VOLUME}:/data:ro" \
  -v "${BACKUP_DIR}:/backup" \
  alpine tar czf "/backup/photos_${TIMESTAMP}.tar.gz" -C /data .

if [[ "$BACKUP_INCLUDE_MODELS" == "true" && -d "${PROJECT_DIR}/models" ]]; then
  MODELS_FILE="${BACKUP_DIR}/models_${TIMESTAMP}.tar.gz"
  echo "Backing up local LLM models to ${MODELS_FILE}"
  if find "${PROJECT_DIR}/models" -maxdepth 1 -name '*.gguf' -print -quit | grep -q .; then
    tar czf "$MODELS_FILE" -C "${PROJECT_DIR}/models" .
  else
    echo "  No .gguf files in models/ — skipping models archive (run scripts/download-model.sh)"
    MODELS_FILE=""
  fi
elif [[ "$BACKUP_INCLUDE_MODELS" != "true" ]]; then
  echo "Skipping models backup (BACKUP_INCLUDE_MODELS=false)"
fi

cat > "$MANIFEST_FILE" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "compose_project": "${COMPOSE_PROJECT_NAME}",
  "database_file": "$(basename "$DB_FILE")",
  "photos_file": "$(basename "$PHOTOS_FILE")",
  "models_file": $([ -n "$MODELS_FILE" ] && echo "\"$(basename "$MODELS_FILE")\"" || echo "null"),
  "includes_ai": {
    "database_tables": [
      "ai_settings",
      "assistant_memories",
      "assistant_conversations",
      "assistant_messages",
      "plant_story_cache"
    ],
    "photos_paths": ["assistant/placeholder.jpg"],
    "models_host_dir": "models/"
  }
}
EOF

if [[ "$RETENTION_DAYS" -gt 0 ]]; then
  echo "Removing backups older than ${RETENTION_DAYS} days"
  find "$BACKUP_DIR" -type f \( \
    -name 'plantory_*.sql' -o \
    -name 'photos_*.tar.gz' -o \
    -name 'models_*.tar.gz' -o \
    -name 'manifest_*.json' \
    \) -mtime +"$RETENTION_DAYS" -delete
fi

echo "$(date -Iseconds) backup complete: plantory_${TIMESTAMP}"
echo "Manifest: ${MANIFEST_FILE}"
