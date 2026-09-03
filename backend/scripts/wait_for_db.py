import time

import psycopg

from app.core.config import settings


def wait_for_db(max_attempts: int = 30, wait_seconds: int = 2) -> None:
    for attempt in range(1, max_attempts + 1):
        try:
            with psycopg.connect(settings.database_url.replace("+psycopg", "")):
                return
        except Exception:
            if attempt == max_attempts:
                raise
            time.sleep(wait_seconds)


if __name__ == "__main__":
    wait_for_db()
