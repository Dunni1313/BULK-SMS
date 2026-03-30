"""
Entry point for the XAUUSD data pipeline.

Starts:
  - FastAPI app (served by uvicorn)
  - APScheduler background jobs that keep the DB in sync with Twelve Data
"""

import logging
import sys

import uvicorn

from app.config import LOG_LEVEL
from app.database import init_db
from app.scheduler import build_scheduler
from app.api import app  # noqa: F401 – imported so uvicorn can find it

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
    stream=sys.stdout,
)

logger = logging.getLogger(__name__)


def main() -> None:
    logger.info("=== XAUUSD Data Pipeline starting ===")

    # 1. Ensure DB tables exist
    init_db()

    # 2. Start the scheduler (runs initial fetches synchronously, then schedules repeats)
    scheduler = build_scheduler()
    scheduler.start()
    logger.info("Scheduler started with %d jobs.", len(scheduler.get_jobs()))

    # 3. Run FastAPI – blocks until the process is killed
    try:
        uvicorn.run(
            "app.api:app",
            host="0.0.0.0",
            port=8000,
            log_level=LOG_LEVEL.lower(),
            reload=False,
        )
    finally:
        logger.info("Shutting down scheduler …")
        scheduler.shutdown(wait=False)
        logger.info("=== XAUUSD Data Pipeline stopped ===")


if __name__ == "__main__":
    main()
