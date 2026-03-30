from datetime import datetime

from sqlalchemy import Column, DateTime, Float, BigInteger, UniqueConstraint
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
