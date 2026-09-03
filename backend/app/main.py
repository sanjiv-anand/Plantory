from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings
from app.utils.init_dirs import ensure_storage_dirs

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    ensure_storage_dirs()


@app.get("/healthz")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


app.mount(settings.photos_public_base, StaticFiles(directory=settings.photos_root), name="media")
app.include_router(api_router, prefix="/api")
