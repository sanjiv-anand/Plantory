#!/usr/bin/env sh
set -eu

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-/data/backups}"
PGHOST="${POSTGRES_HOST:-postgres}"
PGUSER="${POSTGRES_USER:-postgres}"
PGDATABASE="${POSTGRES_DB:-lilylog}"

mkdir -p "$BACKUP_DIR"
pg_dump -h "$PGHOST" -U "$PGUSER" "$PGDATABASE" > "${BACKUP_DIR}/lilylog_${TIMESTAMP}.sql"
