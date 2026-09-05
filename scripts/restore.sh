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

usage() {
  cat <<'EOF'
Usage:
  scripts/restore.sh --db /path/to/plantory_YYYYMMDD_HHMMSS.sql
  scripts/restore.sh --photos /path/to/photos_YYYYMMDD_HHMMSS.tar.gz
  scripts/restore.sh --models /path/to/models_YYYYMMDD_HHMMSS.tar.gz
  scripts/restore.sh --db ... --photos ... --models ...

Restores database dumps, photo archives, and/or local LLM models created by scripts/backup.sh.

A full AI-aware restore uses all three:
  --db      PostgreSQL (memories, chat history, AI settings, journals, plants)
  --photos  Photo volume (includes assistant-logged entry placeholders)
  --models  Host models/ directory (GGUF files for the local LLM)
EOF
}

COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$(read_env COMPOSE_PROJECT_NAME plantory)}"
POSTGRES_DB="${POSTGRES_DB:-$(read_env POSTGRES_DB plantory)}"
POSTGRES_USER="${POSTGRES_USER:-$(read_env POSTGRES_USER postgres)}"
PHOTOS_VOLUME="${COMPOSE_PROJECT_NAME}_photos_data"

DB_FILE=""
PHOTOS_FILE=""
MODELS_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db)
      DB_FILE="${2:-}"
      shift 2
      ;;
    --photos)
      PHOTOS_FILE="${2:-}"
      shift 2
      ;;
    --models)
      MODELS_FILE="${2:-}"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$DB_FILE" && -z "$PHOTOS_FILE" && -z "$MODELS_FILE" ]]; then
  usage
  exit 1
fi

if [[ -n "$DB_FILE" ]]; then
  if [[ ! -f "$DB_FILE" ]]; then
    echo "Database backup not found: $DB_FILE" >&2
    exit 1
  fi
  echo "Restoring database from $DB_FILE"
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$DB_FILE"
fi

if [[ -n "$PHOTOS_FILE" ]]; then
  if [[ ! -f "$PHOTOS_FILE" ]]; then
    echo "Photos backup not found: $PHOTOS_FILE" >&2
    exit 1
  fi
  if ! docker volume inspect "$PHOTOS_VOLUME" >/dev/null 2>&1; then
    echo "Photos volume not found: $PHOTOS_VOLUME" >&2
    exit 1
  fi
  echo "Restoring photos from $PHOTOS_FILE"
  docker run --rm \
    -v "${PHOTOS_VOLUME}:/data" \
    -v "$(cd "$(dirname "$PHOTOS_FILE")" && pwd):/backup:ro" \
    alpine sh -c "cd /data && tar xzf /backup/$(basename "$PHOTOS_FILE")"
fi

if [[ -n "$MODELS_FILE" ]]; then
  if [[ ! -f "$MODELS_FILE" ]]; then
    echo "Models backup not found: $MODELS_FILE" >&2
    exit 1
  fi
  mkdir -p "${PROJECT_DIR}/models"
  echo "Restoring LLM models to ${PROJECT_DIR}/models"
  tar xzf "$MODELS_FILE" -C "${PROJECT_DIR}/models"
  echo "Restart LLM to pick up models: docker compose restart llm"
fi

echo "$(date -Iseconds) restore complete"
