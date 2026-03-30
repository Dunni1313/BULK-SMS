from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, BigInteger, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def _candle_table(table_name: str):
    """Factory that returns an ORM model class mapped to the given table name."""

    class Candle(Base):
        __tablename__ = table_name
        __table_args__ = (
            UniqueConstraint("datetime", name=f"uq_{table_name}_datetime"),
            {"extend_existing": True},
        )

        id = Column(BigInteger, primary_key=True, autoincrement=True)
        datetime = Column(DateTime(timezone=False), nullable=False, index=True)
        open = Column(Float, nullable=False)
        high = Column(Float, nullable=False)
        low = Column(Float, nullable=False)
        close = Column(Float, nullable=False)
        volume = Column(Float, nullable=False)
        fetched_at = Column(DateTime(timezone=False), default=datetime.utcnow, nullable=False)

        def __repr__(self) -> str:
            return f"<Candle {table_name} {self.datetime} close={self.close}>"

    Candle.__name__ = f"Candle_{table_name}"
    return Candle


# One ORM class per timeframe
Candle15Min = _candle_table("candles_15min")
Candle1H    = _candle_table("candles_1h")
Candle4H    = _candle_table("candles_4h")
Candle1Day  = _candle_table("candles_1day")

TIMEFRAME_MODEL_MAP: dict[str, type] = {
    "15min": Candle15Min,
    "1h":    Candle1H,
    "4h":    Candle4H,
    "1day":  Candle1Day,
}


# ── Indicator tables ──────────────────────────────────────────────────────────

def _indicator_table(table_name: str):
    """Factory for per-timeframe indicator ORM models."""

    class Indicator(Base):
        __tablename__ = table_name
        __table_args__ = (
            UniqueConstraint("datetime", name=f"uq_{table_name}_datetime"),
            {"extend_existing": True},
        )

        id          = Column(BigInteger, primary_key=True, autoincrement=True)
        datetime    = Column(DateTime(timezone=False), nullable=False, index=True)
        ema_20      = Column(Float, nullable=True)
        ema_50      = Column(Float, nullable=True)
        ema_200     = Column(Float, nullable=True)
        rsi_14      = Column(Float, nullable=True)
        atr_14      = Column(Float, nullable=True)
        macd_line   = Column(Float, nullable=True)
        macd_signal = Column(Float, nullable=True)
        macd_hist   = Column(Float, nullable=True)
        bb_upper    = Column(Float, nullable=True)
        bb_middle   = Column(Float, nullable=True)
        bb_lower    = Column(Float, nullable=True)
        computed_at = Column(DateTime(timezone=False), default=datetime.utcnow, nullable=False)

        def __repr__(self) -> str:
            return f"<Indicator {table_name} {self.datetime}>"

    Indicator.__name__ = f"Indicator_{table_name}"
    return Indicator


Indicator15Min = _indicator_table("indicators_15min")
Indicator1H    = _indicator_table("indicators_1h")
Indicator4H    = _indicator_table("indicators_4h")
Indicator1Day  = _indicator_table("indicators_1day")

TIMEFRAME_INDICATOR_MAP: dict[str, type] = {
    "15min": Indicator15Min,
    "1h":    Indicator1H,
    "4h":    Indicator4H,
    "1day":  Indicator1Day,
}


# ── Signal tables ─────────────────────────────────────────────────────────────

def _signal_table(table_name: str):
    """Factory for per-timeframe signal ORM models."""

    class Signal(Base):
        __tablename__ = table_name
        __table_args__ = (
            UniqueConstraint("datetime", name=f"uq_{table_name}_datetime"),
            {"extend_existing": True},
        )

        id                = Column(BigInteger, primary_key=True, autoincrement=True)
        datetime          = Column(DateTime(timezone=False), nullable=False, index=True)
        signal            = Column(String(10), nullable=False)   # BUY | SELL | NEUTRAL
        confidence        = Column(Float, nullable=False)        # 0–100
        ema_score         = Column(Float, nullable=False)
        rsi_score         = Column(Float, nullable=False)
        macd_score        = Column(Float, nullable=False)
        bb_score          = Column(Float, nullable=False)
        atr_filter_passed = Column(Boolean, nullable=False)
        computed_at       = Column(DateTime(timezone=False), default=datetime.utcnow, nullable=False)

        def __repr__(self) -> str:
            return f"<Signal {table_name} {self.datetime} {self.signal} conf={self.confidence:.1f}>"

    Signal.__name__ = f"Signal_{table_name}"
    return Signal


Signal15Min = _signal_table("signals_15min")
Signal1H    = _signal_table("signals_1h")
Signal4H    = _signal_table("signals_4h")
Signal1Day  = _signal_table("signals_1day")

TIMEFRAME_SIGNAL_MAP: dict[str, type] = {
    "15min": Signal15Min,
    "1h":    Signal1H,
    "4h":    Signal4H,
    "1day":  Signal1Day,
}
