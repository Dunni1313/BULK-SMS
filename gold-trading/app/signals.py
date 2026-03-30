"""
Signal computation and persistence.

Public API:
    compute_and_store_signals(label, session) -> None
        Loads the latest candles for the given timeframe, computes indicators,
        scores each bar, and upserts results into indicators_* and signals_* tables.
"""

import logging
from datetime import datetime

import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.config import ATR_MIN_PCT, INDICATOR_LOOKBACK, SIGNAL_THRESHOLD
from app.indicators import compute_indicators
from app.models import TIMEFRAME_INDICATOR_MAP, TIMEFRAME_MODEL_MAP, TIMEFRAME_SIGNAL_MAP

logger = logging.getLogger(__name__)


# ── EMA scoring ──────────────────────────────────────────────────────────────

def _ema_scores(df: pd.DataFrame) -> pd.Series:
    """
    Return a Series of EMA sub-scores in [-1.0, +1.0].

    Trend stack logic + EMA-20/50 crossover boost.
    """
    c   = df["close"]
    e20 = df["ema_20"]
    e50 = df["ema_50"]
    e200 = df["ema_200"]

    score = pd.Series(0.0, index=df.index)

    # Full bull / bear stack
    full_bull = (c > e20) & (e20 > e50) & (e50 > e200)
    full_bear = (c < e20) & (e20 < e50) & (e50 < e200)
    score[full_bull] =  1.0
    score[full_bear] = -1.0

    # Partial stacks (not overwriting full)
    partial_bull = (~full_bull) & (c > e20) & (e20 > e50) & (e50 < e200)
    partial_bear = (~full_bear) & (c < e20) & (e20 < e50) & (e50 > e200)
    score[partial_bull] =  0.5
    score[partial_bear] = -0.5

    # Close above/below ema_20 only
    minor_bull = (~full_bull) & (~partial_bull) & (c > e20)
    minor_bear = (~full_bear) & (~partial_bear) & (c < e20)
    score[minor_bull] =  0.25
    score[minor_bear] = -0.25

    # Crossover boost: ema_20 crosses above/below ema_50
    above     = e20 > e50
    cross_up   = above  & ~above.shift(1).fillna(False)
    cross_down = ~above & above.shift(1).fillna(False)
    score = (score + cross_up.astype(float) * 0.25 - cross_down.astype(float) * 0.25).clip(-1.0, 1.0)

    # NaN if any indicator is missing
    has_nan = e20.isna() | e50.isna() | e200.isna()
    score[has_nan] = np.nan

    return score


# ── RSI scoring ──────────────────────────────────────────────────────────────

def _rsi_scores(df: pd.DataFrame) -> pd.Series:
    """Map RSI to [-1.0, +1.0] using mean-reversion framing."""
    rsi   = df["rsi_14"]
    score = pd.Series(0.0, index=df.index)

    score[rsi < 30]                     =  1.0
    score[(rsi >= 30) & (rsi < 40)]     =  0.5
    score[(rsi >= 40) & (rsi < 45)]     =  0.25
    score[(rsi >= 55) & (rsi < 60)]     = -0.25
    score[(rsi >= 60) & (rsi < 70)]     = -0.5
    score[rsi >= 70]                    = -1.0

    score[rsi.isna()] = np.nan
    return score


# ── MACD scoring ─────────────────────────────────────────────────────────────

def _macd_scores(df: pd.DataFrame) -> pd.Series:
    """Combine histogram sign, histogram momentum, and zero-line position."""
    hist   = df["macd_hist"]
    line   = df["macd_line"]

    hist_sign     = hist.apply(lambda v: 0.5 if v > 0 else (-0.5 if v < 0 else 0.0))
    hist_momentum = (hist - hist.shift(1)).apply(
        lambda v: 0.25 if v > 0 else (-0.25 if v < 0 else 0.0)
    )
    zero_line     = line.apply(lambda v: 0.25 if v > 0 else (-0.25 if v < 0 else 0.0))

    score = (hist_sign + hist_momentum + zero_line).clip(-1.0, 1.0)

    has_nan = hist.isna() | line.isna() | df["macd_signal"].isna()
    score[has_nan] = np.nan
    return score


# ── Bollinger Band scoring ────────────────────────────────────────────────────

def _bb_scores(df: pd.DataFrame) -> pd.Series:
    """Score based on %B position within the bands."""
    close  = df["close"]
    upper  = df["bb_upper"]
    lower  = df["bb_lower"]

    band_width = (upper - lower).replace(0, np.nan)
    pct_b      = (close - lower) / band_width   # 0 = at lower, 1 = at upper

    score = pd.Series(0.0, index=df.index)
    score[pct_b < 0]                          =  1.0
    score[(pct_b >= 0)   & (pct_b < 0.2)]    =  0.5
    score[(pct_b >= 0.2) & (pct_b < 0.4)]    =  0.2
    score[(pct_b >= 0.6) & (pct_b < 0.8)]    = -0.2
    score[(pct_b >= 0.8) & (pct_b < 1.0)]    = -0.5
    score[pct_b >= 1.0]                       = -1.0

    has_nan = upper.isna() | lower.isna() | pct_b.isna()
    score[has_nan] = np.nan
    return score


# ── ATR filter ───────────────────────────────────────────────────────────────

def _atr_filter(df: pd.DataFrame) -> pd.Series:
    """Return boolean Series; True = sufficient volatility to trade."""
    atr_pct = df["atr_14"] / df["close"].replace(0, np.nan)
    return atr_pct > ATR_MIN_PCT


# ── Composite signal assembly ─────────────────────────────────────────────────

def _assemble_signals(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute all sub-scores and assemble the composite signal for every row.
    Returns a DataFrame with columns:
        datetime, signal, confidence, ema_score, rsi_score, macd_score,
        bb_score, atr_filter_passed
    """
    ema_s  = _ema_scores(df)
    rsi_s  = _rsi_scores(df)
    macd_s = _macd_scores(df)
    bb_s   = _bb_scores(df)
    atr_ok = _atr_filter(df)

    raw = (
        0.35 * ema_s.fillna(0)
        + 0.25 * rsi_s.fillna(0)
        + 0.25 * macd_s.fillna(0)
        + 0.15 * bb_s.fillna(0)
    )

    confidence = (raw.abs() * 100.0).clip(0, 100)
    confidence[~atr_ok] = (confidence[~atr_ok] - 30).clip(0, 100)

    # Any bar where a core indicator was NaN → NEUTRAL, 0 confidence
    any_nan = ema_s.isna() | rsi_s.isna() | macd_s.isna() | bb_s.isna()
    confidence[any_nan] = 0.0

    def _direction(row_raw, row_conf, row_nan):
        if row_nan or row_conf < SIGNAL_THRESHOLD:
            return "NEUTRAL"
        return "BUY" if row_raw > 0 else ("SELL" if row_raw < 0 else "NEUTRAL")

    signal_col = pd.Series(
        [_direction(r, c, n) for r, c, n in zip(raw, confidence, any_nan)],
        index=df.index,
    )

    out = pd.DataFrame(
        {
            "datetime":          df["datetime"].values,
            "signal":            signal_col.values,
            "confidence":        confidence.values,
            "ema_score":         ema_s.fillna(0).values,
            "rsi_score":         rsi_s.fillna(0).values,
            "macd_score":        macd_s.fillna(0).values,
            "bb_score":          bb_s.fillna(0).values,
            "atr_filter_passed": atr_ok.values,
        }
    )
    return out


# ── Main entry point ──────────────────────────────────────────────────────────

def compute_and_store_signals(label: str, session: Session) -> None:
    """
    Load the latest candle rows for *label*, compute indicators + signals,
    then upsert both into the indicator and signal tables.

    Designed to be called after a successful candle upsert.
    """
    candle_model    = TIMEFRAME_MODEL_MAP[label]
    indicator_model = TIMEFRAME_INDICATOR_MAP[label]
    signal_model    = TIMEFRAME_SIGNAL_MAP[label]

    # Load candles
    rows = session.execute(
        select(candle_model)
        .order_by(candle_model.datetime.asc())
        .limit(INDICATOR_LOOKBACK)
    ).scalars().all()

    if not rows:
        logger.warning("[%s] No candles found; skipping signal computation.", label)
        return

    df = pd.DataFrame(
        [
            {
                "datetime": r.datetime,
                "open":     r.open,
                "high":     r.high,
                "low":      r.low,
                "close":    r.close,
                "volume":   r.volume,
            }
            for r in rows
        ]
    )

    df = compute_indicators(df)
    signals_df = _assemble_signals(df)

    now = datetime.utcnow()

    # ── Upsert indicators ────────────────────────────────────────────────────
    ind_table = indicator_model.__table__
    ind_rows = [
        {
            "datetime":    row["datetime"],
            "ema_20":      _nan_to_none(row["ema_20"]),
            "ema_50":      _nan_to_none(row["ema_50"]),
            "ema_200":     _nan_to_none(row["ema_200"]),
            "rsi_14":      _nan_to_none(row["rsi_14"]),
            "atr_14":      _nan_to_none(row["atr_14"]),
            "macd_line":   _nan_to_none(row["macd_line"]),
            "macd_signal": _nan_to_none(row["macd_signal"]),
            "macd_hist":   _nan_to_none(row["macd_hist"]),
            "bb_upper":    _nan_to_none(row["bb_upper"]),
            "bb_middle":   _nan_to_none(row["bb_middle"]),
            "bb_lower":    _nan_to_none(row["bb_lower"]),
            "computed_at": now,
        }
        for _, row in df.iterrows()
    ]

    session.execute(
        insert(ind_table)
        .values(ind_rows)
        .on_conflict_do_update(
            index_elements=["datetime"],
            set_={c: insert(ind_table).excluded[c] for c in ind_rows[0] if c != "datetime"},
        )
    )

    # ── Upsert signals ───────────────────────────────────────────────────────
    sig_table = signal_model.__table__
    sig_rows = [
        {
            "datetime":          row["datetime"],
            "signal":            row["signal"],
            "confidence":        float(row["confidence"]),
            "ema_score":         float(row["ema_score"]),
            "rsi_score":         float(row["rsi_score"]),
            "macd_score":        float(row["macd_score"]),
            "bb_score":          float(row["bb_score"]),
            "atr_filter_passed": bool(row["atr_filter_passed"]),
            "computed_at":       now,
        }
        for _, row in signals_df.iterrows()
    ]

    session.execute(
        insert(sig_table)
        .values(sig_rows)
        .on_conflict_do_update(
            index_elements=["datetime"],
            set_={c: insert(sig_table).excluded[c] for c in sig_rows[0] if c != "datetime"},
        )
    )

    session.commit()
    logger.info(
        "[%s] Stored %d indicator rows + %d signal rows.",
        label, len(ind_rows), len(sig_rows),
    )


def _nan_to_none(value):
    """Convert numpy NaN to Python None for DB insertion."""
    if value is None:
        return None
    try:
        return None if np.isnan(value) else float(value)
    except (TypeError, ValueError):
        return value
