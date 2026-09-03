# LILYLOG

LILYLOG is a self-hosted, production-oriented plant journaling and monitoring app with multi-plant tracking, daily photo journaling, weather snapshots, timeline/calendar history, and Docker-first deployment.

## Stack

- Frontend: React + TypeScript + Vite + Tailwind + React Router + TanStack Query + PWA
- Backend: FastAPI + SQLAlchemy 2.x + Pydantic + Alembic
- Database: PostgreSQL
- Photo storage: Persistent filesystem volume (metadata in PostgreSQL)
- Deployment: Docker Compose

## Features

- Create and manage multiple plants with detailed plant profile fields.
- Add daily entries with iPhone-friendly camera/photo-picker upload flow.
- Server-side image validation and normalization (JPEG/PNG/WebP, HEIC support via pillow-heif).
- Store original, display, and thumbnail image variants with unique file names.
- Automatic weather snapshot per entry using Open-Meteo for plants with coordinates.
- Plant timeline, calendar history, photo comparison, and weather trend summaries.
- Entry deletion support.
- PWA support for installable mobile experience.

## Quick start

1. Copy config:

   ```bash
   cp .env.example .env
   ```

2. Start services:

   ```bash
   docker compose up -d --build
   ```

3. Access:
   - Frontend: `http://localhost:4173`
   - Backend API docs: `http://localhost:8000/docs`

## Persistence

Docker volumes:

- `postgres_data`: PostgreSQL data files
- `photos_data`: Uploaded photos (`/data/photos`)
- `backups_data`: Database dumps (`/data/backups`)

## Backups

LILYLOG stores photos on disk and metadata in PostgreSQL, so a full backup includes both.

### Full backup (recommended)

From the project root on the host:

```bash
chmod +x scripts/backup.sh scripts/restore.sh
./scripts/backup.sh
```

This writes timestamped files to `~/lilylog-backups` by default:

- `lilylog_YYYYMMDD_HHMMSS.sql` — database dump
- `photos_YYYYMMDD_HHMMSS.tar.gz` — photo volume archive

Configure in `.env`:

- `BACKUP_HOST_DIR` — where host backups are stored
- `BACKUP_RETENTION_DAYS` — auto-delete older backups (default `14`, set `0` to keep all)

### Nightly automatic backup

Schedule the same script with cron on Linux:

```bash
crontab -e
```

Example: run every night at 2:00 AM:

```cron
0 2 * * * /path/to/LilyLog/scripts/backup.sh >> /var/log/lilylog-backup.log 2>&1
```

On macOS, prefer `launchd` if the machine may sleep.

Optional: sync `BACKUP_HOST_DIR` off the server with `rsync`, `rclone`, or `restic`.

### Restore

```bash
./scripts/restore.sh --db ~/lilylog-backups/lilylog_20260903_020000.sql
./scripts/restore.sh --photos ~/lilylog-backups/photos_20260903_020000.tar.gz
```

Restore both together when recovering from a full loss.

### Database-only backup (inside container)

Quick DB dump to the Docker `backups_data` volume:

```bash
docker compose exec backend sh scripts/backup.sh
```

This does not include photos. Use `scripts/backup.sh` on the host for complete backups.

## API overview

- `GET /api/plants`
- `POST /api/plants`
- `GET /api/plants/{plant_id}`
- `PATCH /api/plants/{plant_id}`
- `DELETE /api/plants/{plant_id}`
- `GET /api/plants/{plant_id}/entries`
- `POST /api/plants/{plant_id}/entries` (multipart form with `photo`)
- `PATCH /api/plants/{plant_id}/entries/{entry_id}`
- `DELETE /api/plants/{plant_id}/entries/{entry_id}`
- `GET /api/plants/{plant_id}/events`
- `POST /api/plants/{plant_id}/events`
- `GET /api/weather/current?latitude=..&longitude=..`

## Notes

- Place production TLS/reverse proxy in front if required; app is compatible with Tailscale Serve.
- Filesystem media is not stored in PostgreSQL by design.
