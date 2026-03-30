import os
from dotenv import load_dotenv

load_dotenv()


def _require(key: str) -> str:
    value = os.getenv(key)
    if not value:
        raise EnvironmentError(f"Required environment variable '{key}' is not set.")
    return value


TWELVE_DATA_API_KEY: str = _require("TWELVE_DATA_API_KEY")

DB_HOST: str = os.getenv("DB_HOST", "localhost")
DB_PORT: str = os.getenv("DB_PORT", "5432")
DB_NAME: str = os.getenv("DB_NAME", "gold_trading")
DB_USER: str = _require("DB_USER")
DB_PASSWORD: str = _require("DB_PASSWORD")

DATABASE_URL: str = (
    f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO").upper()

SYMBOL = "XAU/USD"
CANDLE_LIMIT = 200

# Signal layer
SIGNAL_THRESHOLD: float = float(os.getenv("SIGNAL_THRESHOLD", "30"))
ATR_MIN_PCT: float      = float(os.getenv("ATR_MIN_PCT", "0.001"))
INDICATOR_LOOKBACK: int = int(os.getenv("INDICATOR_LOOKBACK", "200"))

# (interval_label, twelvedata_interval, scheduler_trigger_kwargs)
TIMEFRAMES = [
    ("15min", "15min", {"minutes": 15}),
    ("1h",    "1h",    {"hours": 1}),
    ("4h",    "4h",    {"hours": 4}),
    ("1day",  "1day",  {"hours": 24}),
]
