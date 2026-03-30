from datetime import timezone
from typing import Any

from fastapi import FastAPI
from sqlalchemy import func, select

from app.database import SessionLocal, check_db_connection
from app.models import TIMEFRAME_MODEL_MAP
from app.scheduler import last_update

app = FastAPI(title="XAUUSD Data Pipeline", version="1.0.0")


@app.get("/health", summary="Pipeline health check")
def health() -> dict[str, Any]:
    db_ok = check_db_connection()

    timeframe_stats: dict[str, Any] = {}
    for label, model in TIMEFRAME_MODEL_MAP.items():
        try:
            with SessionLocal() as session:
                row_count = session.execute(
                    select(func.count()).select_from(model)
                ).scalar_one()
                latest_candle = session.execute(
                    select(func.max(model.datetime))
                ).scalar_one()
        except Exception as exc:
            timeframe_stats[label] = {"error": str(exc)}
            continue

        lu = last_update.get(label)
        timeframe_stats[label] = {
            "row_count":          row_count,
            "latest_candle_utc":  latest_candle.isoformat() if latest_candle else None,
            "last_fetched_utc":   lu.astimezone(timezone.utc).isoformat() if lu else None,
        }

    overall = "ok" if db_ok and all("error" not in v for v in timeframe_stats.values()) else "degraded"

    return {
        "status":     overall,
        "db_online":  db_ok,
        "timeframes": timeframe_stats,
    }


@app.get("/", include_in_schema=False)
def root():
    return {"message": "XAUUSD data pipeline is running. See /health or /docs."}
