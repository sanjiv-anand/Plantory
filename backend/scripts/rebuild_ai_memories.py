#!/usr/bin/env python3
"""Rebuild assistant memories from plant metadata, events, and journal entries."""

from __future__ import annotations

import app.db.base  # noqa: F401 — register all ORM models before queries
from app.db.session import SessionLocal
from app.services.memory_service import MemoryService


def main() -> None:
    db = SessionLocal()
    try:
        result = MemoryService(db).rebuild_memories()
        print(f"AI memory rebuild complete: cleared={result['cleared']} created={result['created']}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
