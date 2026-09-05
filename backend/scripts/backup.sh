#!/usr/bin/env sh
set -eu

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-/data/backups}"
PGHOST="${POSTGRES_HOST:-postgres}"
PGUSER="${POSTGRES_USER:-postgres}"
PGDATABASE="${POSTGRES_DB:-plantory}"

mkdir -p "$BACKUP_DIR"
echo "Dumping database (includes AI memories, settings, chat history)..."
pg_dump -h "$PGHOST" -U "$PGUSER" "$PGDATABASE" > "${BACKUP_DIR}/plantory_${TIMESTAMP}.sql"
echo "Wrote ${BACKUP_DIR}/plantory_${TIMESTAMP}.sql"
echo "Note: photos and GGUF models are not included — use scripts/backup.sh on the host for a full backup."
