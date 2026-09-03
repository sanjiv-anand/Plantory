#!/usr/bin/env sh
set -eu

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "${BACKUP_DIR:-/data/backups}"
pg_dump "${DATABASE_URL:?DATABASE_URL is required}" > "${BACKUP_DIR:-/data/backups}/lilylog_${TIMESTAMP}.sql"
