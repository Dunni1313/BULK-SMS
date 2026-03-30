import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.dialects.postgresql import insert

from app.config import TIMEFRAMES
from app.database import SessionLocal
from app.fetcher import fetch_candles
from app.models import TIMEFRAME_MODEL_MAP

logger = logging.getLogger(__name__)

# Tracks the last successful update time per timeframe label
last_update: dict[str, datetime | None] = {label: None for label, _, _ in TIMEFRAMES}


def _upsert_candles(label: str, interval: str) -> None:
    """Fetch candles and upsert into the corresponding table."""
    try:
        candles = fetch_candles(interval)
    except Exception as exc:
        logger.error("[%s] Failed to fetch candles: %s", label, exc)
        return

    model = TIMEFRAME_MODEL_MAP[label]
    table = model.__table__

    rows = [
        {
            "datetime":   c["datetime"],
            "open":       c["open"],
            "high":       c["high"],
            "low":        c["low"],
            "close":      c["close"],
            "volume":     c["volume"],
            "fetched_at": datetime.utcnow(),
        }
        for c in candles
    ]

    try:
        with SessionLocal() as session:
            stmt = (
                insert(table)
                .values(rows)
                .on_conflict_do_update(
                    index_elements=["datetime"],
                    set_={
                        "open":       insert(table).excluded.open,
                        "high":       insert(table).excluded.high,
                        "low":        insert(table).excluded.low,
                        "close":      insert(table).excluded.close,
                        "volume":     insert(table).excluded.volume,
                        "fetched_at": insert(table).excluded.fetched_at,
                    },
                )
            )
            session.execute(stmt)
            session.commit()

        last_update[label] = datetime.now(tz=timezone.utc)
        logger.info("[%s] Upserted %d candles. Last update: %s", label, len(rows), last_update[label])

    except Exception as exc:
        logger.error("[%s] DB upsert failed: %s", label, exc)
        return

    # Compute indicators + signals after a successful candle upsert
    try:
        from app.signals import compute_and_store_signals  # local import avoids circular deps
        with SessionLocal() as session:
            compute_and_store_signals(label, session)
        logger.info("[%s] Signals recomputed successfully.", label)
    except Exception as exc:
        logger.error("[%s] Signal computation failed (candles are safe): %s", label, exc)


def build_scheduler() -> BackgroundScheduler:
    """Create and configure the APScheduler instance."""
    scheduler = BackgroundScheduler(timezone="UTC")

    for label, interval, trigger_kwargs in TIMEFRAMES:
        # Run immediately on startup, then on the defined interval
        _upsert_candles(label, interval)

        scheduler.add_job(
            func=_upsert_candles,
            trigger=IntervalTrigger(**trigger_kwargs),
            args=[label, interval],
            id=f"fetch_{label}",
            name=f"Fetch XAUUSD {label}",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=60,
        )
        logger.info("Scheduled job: fetch_%s every %s", label, trigger_kwargs)

    return scheduler
