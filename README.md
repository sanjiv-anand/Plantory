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
- **Local AI Assistant** — private LilyLog Assistant powered by llama.cpp and a small on-server GGUF model (no cloud LLM APIs).

## Quick start

1. Copy config:

   ```bash
   cp .env.example .env
   ```

2. Start services:

   ```bash
   docker compose up -d --build
   ```

   Or use the rebuild helper (build, migrate, optional model + memory rebuild):

   ```bash
   chmod +x scripts/rebuild.sh scripts/backup.sh scripts/restore.sh scripts/download-model.sh
   ./scripts/rebuild.sh --download-model --rebuild-memories
   ```

3. Access:
   - App: `http://localhost:4173` (single service serves UI, `/api`, and `/media`)
   - Backend API docs: `http://localhost:8000/docs`

## Persistence

Docker volumes:

- `postgres_data`: PostgreSQL data files
- `photos_data`: Uploaded photos (`/data/photos`)
- `photos_data`: Uploaded photos (`/data/photos`), including assistant-logged entry placeholders
- `backups_data`: Database dumps (`/data/backups`)
- `./models/` (host bind mount): Local GGUF model files for the LLM — **not** a Docker volume; back up separately or use `scripts/backup.sh`

## Rebuild after updates

When you pull new code (migrations, AI features, frontend changes):

```bash
./scripts/rebuild.sh
```

Common options:

| Flag | Purpose |
|------|---------|
| `--download-model` | Download the GGUF model if `models/` is empty |
| `--rebuild-memories` | Rescan plants, events, and journals → rebuild `assistant_memories` |
| `--no-cache` | Force a clean Docker build |
| `--up-only` | Skip build; just `docker compose up -d` |

Examples:

```bash
# First-time setup with AI
./scripts/rebuild.sh --download-model --rebuild-memories

# After a git pull
./scripts/rebuild.sh --rebuild-memories

# Rebuild AI memories only (stack already running)
docker compose exec backend python -m scripts.rebuild_ai_memories
```

Migrations run automatically on backend start; `rebuild.sh` also runs `alembic upgrade head` explicitly for safety.

## Backups

LILYLOG stores photos on disk, LLM models on the host, and metadata (including AI memories) in PostgreSQL — a **full** backup includes all three.

### What is backed up

| Component | Where it lives | Backup file |
|-----------|----------------|-------------|
| Plants, journals, events | PostgreSQL | `lilylog_*.sql` |
| AI settings, memories, chat history, story cache | PostgreSQL (same dump) | `lilylog_*.sql` |
| Plant photos + assistant placeholders | `photos_data` volume | `photos_*.tar.gz` |
| Local GGUF model | `./models/` on host | `models_*.tar.gz` (optional) |

Each run also writes `manifest_*.json` listing what was included.

### Full backup (recommended)

From the project root on the host:

```bash
chmod +x scripts/backup.sh scripts/restore.sh
./scripts/backup.sh
```

This writes timestamped files to `~/lilylog-backups` by default:

- `lilylog_YYYYMMDD_HHMMSS.sql` — database dump (includes AI tables)
- `photos_YYYYMMDD_HHMMSS.tar.gz` — photo volume archive
- `models_YYYYMMDD_HHMMSS.tar.gz` — GGUF model(s), if present in `models/`
- `manifest_YYYYMMDD_HHMMSS.json` — backup manifest

Configure in `.env`:

- `BACKUP_HOST_DIR` — where host backups are stored
- `BACKUP_RETENTION_DAYS` — auto-delete older backups (default `14`, set `0` to keep all)
- `BACKUP_INCLUDE_MODELS` — include `models/*.gguf` in backup (default `true`; set `false` to save ~500 MB per backup)

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
./scripts/restore.sh \
  --db ~/lilylog-backups/lilylog_20260903_020000.sql \
  --photos ~/lilylog-backups/photos_20260903_020000.tar.gz \
  --models ~/lilylog-backups/models_20260903_020000.tar.gz
```

Restore all three together when recovering from a full loss. After restoring models, restart the LLM:

```bash
docker compose restart llm
```

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
- `GET /api/ai/status`
- `PATCH /api/ai/settings`
- `POST /api/ai/test`
- `GET /api/ai/memory`
- `POST /api/ai/memory/rebuild`
- `GET /api/plants/{plant_id}/assistant/context`
- `POST /api/plants/{plant_id}/assistant/chat`
- `POST /api/plants/{plant_id}/assistant/summary`
- `POST /api/plants/{plant_id}/assistant/story`

## Local AI Assistant

LilyLog includes an optional **LilyLog Assistant** that runs entirely on your server using [llama.cpp](https://github.com/ggml-org/llama.cpp). The browser never talks to the LLM directly — only the backend does, over the internal Docker network.

### Architecture

```
iPhone → Tailscale Serve → LilyLog (frontend + backend) → llm service → GGUF model
```

The `llm` container is **not** exposed to the host or Tailscale. If the LLM is offline, the rest of LilyLog keeps working and the UI shows **Assistant unavailable**.

### 1. Download a small GGUF model

Recommended: **Qwen3-0.6B** (Q4 quantization, ~400–700 MB).

Example (adjust URL to a current Hugging Face / model host release):

```bash
chmod +x scripts/download-model.sh
./scripts/download-model.sh
```

Or manually:

```bash
curl -L --fail -o models/Qwen_Qwen3-0.6B-Q4_K_M.gguf \
  "https://huggingface.co/bartowski/Qwen_Qwen3-0.6B-GGUF/resolve/main/Qwen_Qwen3-0.6B-Q4_K_M.gguf"
```

Place the file at:

```
models/Qwen_Qwen3-0.6B-Q4_K_M.gguf
```

Verify it is a real GGUF (should be ~484 MB, not a tiny text file):

```bash
ls -lh models/Qwen_Qwen3-0.6B-Q4_K_M.gguf
head -c 4 models/Qwen_Qwen3-0.6B-Q4_K_M.gguf   # should print GGUF
```

Model files are gitignored. Do not commit them.

### 2. Configure `.env`

```bash
cp .env.example .env
```

Key variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `LLM_MODEL_PATH` | `/models/Qwen_Qwen3-0.6B-Q4_K_M.gguf` | Path inside the llm container |
| `LLM_BASE_URL` | `http://llm:8080` | Backend → llama-server (internal) |
| `LLM_MODEL` | `qwen3-0.6b` | Model name sent to the API |
| `LLM_MAX_TOKENS` | `256` | Max response length |
| `LLM_TEMPERATURE` | `0.3` | Sampling temperature |
| `AI_DAILY_SUMMARY_ENABLED` | `false` | Optional summaries after entries |
| `AI_STORY_ENABLED` | `true` | Plant story generation |

### 3. Start containers

```bash
docker compose up -d --build
docker compose ps
```

You should see `postgres`, `backend`, and `llm` running. The LLM may take a minute to load the model on first start.

### 4. Verify AI

```bash
curl -s http://localhost:4173/api/ai/status
curl -s -X POST http://localhost:4173/api/ai/test
```

Or open **Settings → Local AI** in the app.

### 5. Use from iPhone PWA

1. Serve LilyLog through Tailscale (port `4173` only — **do not** expose the LLM port).
2. Open a plant page and tap **Ask LilyLog**.
3. Use suggested questions or type your own.

### Resource expectations (CPU, no GPU required)

| Resource | Typical |
|----------|---------|
| Model file | ~400–700 MB (Q4 0.6B) |
| RAM (LLM container) | ~600 MB–1 GB |
| Context size | 2048 tokens (configurable) |
| Response time | ~2–15 s per reply on CPU |
| Concurrent requests | 1 (configurable) |

### Privacy

- All inference runs locally in Docker on your machine.
- Plant data is not sent to OpenAI, Anthropic, or other cloud LLM APIs.
- The only external API LilyLog may still use is **Open-Meteo** for weather (existing feature).

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Assistant unavailable` | Check `docker compose logs llm`, confirm the GGUF file exists in `models/` |
| LLM healthcheck failing | Wait for model load; ensure `LLM_MODEL_PATH` matches the file name |
| Slow replies | Reduce `LLM_MAX_TOKENS`; use a smaller quant; increase `LLM_THREADS` |
| App works but AI does not | Expected — AI is optional and fails gracefully |

### Development / tests

```bash
cd backend
pip install -r requirements.txt
pytest
```

## Notes

- Place production TLS/reverse proxy in front if required; app is compatible with Tailscale Serve.
- With Tailscale Serve, point one HTTPS route at the app port (default `4173`). One port serves the UI, `/api`, and `/media` — no separate Tailscale paths needed.
- Example Tailscale setup on the server:

  ```bash
  sudo tailscale serve reset
  docker compose up -d --build
  sudo tailscale serve --bg https://lilylog.your-tailnet.ts.net http://127.0.0.1:4173
  ```

  Set `WEBAUTHN_RP_ID` to your Tailscale hostname (domain only, no `https://`) and `WEBAUTHN_ORIGIN` to `https://lilylog.your-tailnet.ts.net`.
- Filesystem media is not stored in PostgreSQL by design.
