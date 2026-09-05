#!/usr/bin/env bash
# Rebuild Plantory after code changes: images, migrations, optional model download, optional AI memory rebuild.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

DOWNLOAD_MODEL=false
REBUILD_MEMORIES=false
NO_CACHE=""
SKIP_BUILD=false

usage() {
  cat <<'EOF'
Usage: scripts/rebuild.sh [options]

Rebuild and restart the Plantory Docker stack (runs Alembic migrations on backend start).

Options:
  --download-model     Download the local GGUF model if missing
  --rebuild-memories   Rescan plants/events/journals and rebuild AI memories
  --no-cache           Docker build without cache
  --up-only            Skip build; only docker compose up -d
  -h, --help           Show this help

Examples:
  scripts/rebuild.sh
  scripts/rebuild.sh --download-model --rebuild-memories
  scripts/rebuild.sh --no-cache --rebuild-memories
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --download-model)
      DOWNLOAD_MODEL=true
      shift
      ;;
    --rebuild-memories)
      REBUILD_MEMORIES=true
      shift
      ;;
    --no-cache)
      NO_CACHE="--no-cache"
      shift
      ;;
    --up-only)
      SKIP_BUILD=true
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "$DOWNLOAD_MODEL" == "true" ]]; then
  echo "Ensuring local LLM model is present..."
  "$SCRIPT_DIR/download-model.sh"
fi

if [[ "$SKIP_BUILD" == "true" ]]; then
  echo "Starting stack (no build)..."
  docker compose up -d
else
  echo "Building and starting stack..."
  # shellcheck disable=SC2086
  docker compose up -d --build $NO_CACHE
fi

echo "Waiting for backend health..."
TRIES=0
GATEWAY_PORT="${GATEWAY_PORT:-$(grep -E '^GATEWAY_PORT=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)}"
GATEWAY_PORT="${GATEWAY_PORT:-4173}"
HEALTH_URL="http://127.0.0.1:${GATEWAY_PORT}/healthz"

while [ "$TRIES" -lt 90 ]; do
  STATUS="$(docker compose ps backend --format '{{.State}}' 2>/dev/null || echo unknown)"
  case "$STATUS" in
    restarting|exited)
      echo "Backend is ${STATUS} - recent logs:"
      docker compose logs backend --tail 15 2>/dev/null || true
      ;;
  esac

  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    break
  fi

  TRIES=$((TRIES + 1))
  sleep 2
done

if [ "$TRIES" -ge 90 ]; then
  echo "Backend did not become healthy in time." >&2
  echo "Check logs: docker compose logs backend --tail 50" >&2
  exit 1
fi

echo "Running database migrations..."
docker compose exec -T backend alembic upgrade head

if [[ "$REBUILD_MEMORIES" == "true" ]]; then
  echo "Rebuilding AI memories from journal and plant data..."
  docker compose exec -T backend python -m scripts.rebuild_ai_memories
fi

echo
echo "Rebuild complete."
echo "  App:     http://localhost:${GATEWAY_PORT:-4173}"
echo "  AI test: curl -s -X POST http://localhost:${GATEWAY_PORT:-4173}/api/ai/test"
echo
echo "After verifying, run a full backup: ./scripts/backup.sh"
