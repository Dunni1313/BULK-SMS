import logging
from datetime import datetime

import httpx

from app.config import TWELVE_DATA_API_KEY, SYMBOL, CANDLE_LIMIT

logger = logging.getLogger(__name__)

_BASE_URL = "https://api.twelvedata.com/time_series"
_TIMEOUT = 30  # seconds


def fetch_candles(interval: str) -> list[dict]:
    """
    Fetch the last CANDLE_LIMIT OHLCV candles for SYMBOL at the given interval.

    Returns a list of dicts with keys:
        datetime, open, high, low, close, volume
    Raises on HTTP or API-level errors.
    """
    params = {
        "symbol": SYMBOL,
        "interval": interval,
        "outputsize": CANDLE_LIMIT,
        "apikey": TWELVE_DATA_API_KEY,
        "format": "JSON",
        "order": "ASC",
    }

    logger.info("Fetching %s candles for %s (interval=%s) …", CANDLE_LIMIT, SYMBOL, interval)

    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            response = client.get(_BASE_URL, params=params)
            response.raise_for_status()
    except httpx.TimeoutException:
        raise RuntimeError(f"Request timed out fetching {interval} candles")
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(
            f"HTTP {exc.response.status_code} fetching {interval} candles: {exc.response.text}"
        )

    payload = response.json()

    # Twelve Data wraps errors in the JSON body even on 200 responses
    if payload.get("status") == "error":
        raise RuntimeError(
            f"Twelve Data API error ({interval}): {payload.get('message', 'unknown')}"
        )

    raw_values: list[dict] = payload.get("values", [])
    if not raw_values:
        raise RuntimeError(f"No candle data returned for interval={interval}")

    candles = []
    for row in raw_values:
        candles.append(
            {
                "datetime": datetime.strptime(row["datetime"], "%Y-%m-%d %H:%M:%S"),
                "open":     float(row["open"]),
                "high":     float(row["high"]),
                "low":      float(row["low"]),
                "close":    float(row["close"]),
                "volume":   float(row.get("volume") or 0),
            }
        )

    logger.info("Received %d candles for interval=%s", len(candles), interval)
    return candles
