"""
Pure pandas/numpy indicator computations — no external TA libraries.

Public API:
    compute_indicators(df) -> pd.DataFrame
        Input:  DataFrame with columns [datetime, open, high, low, close, volume]
                sorted ascending by datetime, >= 200 rows recommended.
        Output: same DataFrame with all indicator columns appended in-place.
"""

import numpy as np
import pandas as pd


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Compute all technical indicators and append them as new columns."""
    df = df.copy()
    close = df["close"]
    high  = df["high"]
    low   = df["low"]

    # ── EMA 20 / 50 / 200 ────────────────────────────────────────────────────
    df["ema_20"]  = close.ewm(span=20,  adjust=False).mean()
    df["ema_50"]  = close.ewm(span=50,  adjust=False).mean()
    df["ema_200"] = close.ewm(span=200, adjust=False).mean()

    # ── RSI 14 (Wilder's SMMA via ewm alpha=1/14) ────────────────────────────
    delta  = close.diff()
    gain   = delta.clip(lower=0)
    loss   = (-delta).clip(lower=0)
    avg_g  = gain.ewm(alpha=1 / 14, adjust=False).mean()
    avg_l  = loss.ewm(alpha=1 / 14, adjust=False).mean()
    rs     = avg_g / avg_l.replace(0, np.nan)
    df["rsi_14"] = 100 - (100 / (1 + rs))

    # ── ATR 14 (Wilder's SMMA) ───────────────────────────────────────────────
    prev_close = close.shift(1)
    true_range = pd.concat(
        [
            high - low,
            (high - prev_close).abs(),
            (low  - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    df["atr_14"] = true_range.ewm(alpha=1 / 14, adjust=False).mean()

    # ── MACD (12, 26, 9) ─────────────────────────────────────────────────────
    ema12             = close.ewm(span=12, adjust=False).mean()
    ema26             = close.ewm(span=26, adjust=False).mean()
    df["macd_line"]   = ema12 - ema26
    df["macd_signal"] = df["macd_line"].ewm(span=9, adjust=False).mean()
    df["macd_hist"]   = df["macd_line"] - df["macd_signal"]

    # ── Bollinger Bands (20, 2σ) — population std to match MT4/TradingView ───
    sma20           = close.rolling(20).mean()
    std20           = close.rolling(20).std(ddof=0)
    df["bb_middle"] = sma20
    df["bb_upper"]  = sma20 + 2 * std20
    df["bb_lower"]  = sma20 - 2 * std20

    return df
