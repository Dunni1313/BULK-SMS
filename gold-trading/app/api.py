from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select

from app.database import SessionLocal, check_db_connection
from app.models import TIMEFRAME_MODEL_MAP, TIMEFRAME_SIGNAL_MAP
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


# ── Signal endpoint ───────────────────────────────────────────────────────────

class SubScores(BaseModel):
    ema:  float
    rsi:  float
    macd: float
    bb:   float


class SignalResponse(BaseModel):
    timeframe:         str
    datetime:          datetime
    signal:            str
    confidence:        float
    sub_scores:        SubScores
    atr_filter_passed: bool
    computed_at:       datetime


class SignalsEnvelope(BaseModel):
    timeframe: str
    count:     int
    signals:   list[SignalResponse]


@app.get(
    "/signals/{timeframe}",
    response_model=SignalsEnvelope,
    summary="Latest trading signals for a timeframe",
)
def get_signals(
    timeframe: str,
    limit: int = Query(default=1, ge=1, le=100, description="Number of signals to return"),
) -> SignalsEnvelope:
    if timeframe not in TIMEFRAME_SIGNAL_MAP:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid timeframe '{timeframe}'. Choose from: {list(TIMEFRAME_SIGNAL_MAP.keys())}",
        )

    model = TIMEFRAME_SIGNAL_MAP[timeframe]
    with SessionLocal() as session:
        rows = session.execute(
            select(model).order_by(model.datetime.desc()).limit(limit)
        ).scalars().all()

    signals = [
        SignalResponse(
            timeframe=timeframe,
            datetime=row.datetime,
            signal=row.signal,
            confidence=row.confidence,
            sub_scores=SubScores(
                ema=row.ema_score,
                rsi=row.rsi_score,
                macd=row.macd_score,
                bb=row.bb_score,
            ),
            atr_filter_passed=row.atr_filter_passed,
            computed_at=row.computed_at,
        )
        for row in rows
    ]

    return SignalsEnvelope(timeframe=timeframe, count=len(signals), signals=signals)
