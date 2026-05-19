import yfinance as yf
import json
import time
import asyncio
from typing import Dict, Optional
from datetime import datetime, timedelta, date
from pathlib import Path
from zoneinfo import ZoneInfo

SYMBOLS = ["VOO", "QQQ", "GLD", "USO", "TLT"]
DEFAULT_RISK_FREE_RATE = 0.05
ET = ZoneInfo("America/New_York")

SEED_OVERRIDES = {
    "QQQ": {
        "2026-12-31": {
            "435": {"call": 0.27, "put": 0.27},
            "550": {"call": 0.33, "put": 0.33},
        }
    },
    "GLD": {
        "2027-01-15": {
            "420": {"call": 0.30, "put": 0.30},
        }
    },
    "USO": {
        "2026-06-18": {
            "85": {"call": 0.75, "put": 0.75},
        }
    },
    "TLT": {
        "2026-12-31": {
            "100": {"call": 0.10, "put": 0.10},
        }
    },
}


class PriceService:
    def __init__(self, cache_file: str = "daily_close_cache.json"):
        self._data_dir = Path(__file__).parent
        self._cache_path = self._data_dir / cache_file
        self._prices: Dict[str, float] = {}
        self._dividend_yields: Dict[str, float] = {}
        self._irx_rate: Optional[float] = None
        self._cache_date: Optional[str] = None
        self._load_cache()

    def _load_cache(self):
        if self._cache_path.exists():
            try:
                data = json.loads(self._cache_path.read_text())
                self._cache_date = data.get("date")
                self._prices = data.get("prices", {})
                self._dividend_yields = data.get("dividend_yields", {})
                self._irx_rate = data.get("irx_rate")
            except Exception as e:
                print(f"Failed to load price cache: {e}")

    def _save_cache(self):
        data = {
            "date": self._cache_date or datetime.now(ET).date().isoformat(),
            "prices": self._prices,
            "dividend_yields": self._dividend_yields,
            "irx_rate": self._irx_rate,
        }
        self._cache_path.write_text(json.dumps(data, indent=2, default=str))

    def _market_closed(self) -> bool:
        now_et = datetime.now(ET)
        return now_et.hour >= 16 or now_et.weekday() >= 5

    def _should_fetch(self) -> bool:
        today = datetime.now(ET).date().isoformat()
        return self._cache_date != today and self._market_closed()

    def get_cached_price(self, symbol: str) -> Optional[float]:
        return self._prices.get(symbol)

    def get_all_cached_prices(self) -> Dict[str, float]:
        return {s: self._prices[s] for s in SYMBOLS if s in self._prices}

    def get_last_update_time(self, symbol: str) -> Optional[datetime]:
        return None

    def _fetch_single_price(self, symbol: str) -> Optional[float]:
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="1d")
            if hist.empty:
                return None
            price = float(hist["Close"].iloc[-1])
            return price if price > 0 else None
        except Exception as e:
            print(f"Failed to fetch price for {symbol}: {e}")
            return None

    def _fetch_single_dividend(self, symbol: str) -> Optional[float]:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            if info is None:
                return None
            dy = info.get("dividendYield")
            if dy is not None and dy > 0:
                return float(dy) / 100.0
        except Exception as e:
            print(f"Failed to fetch dividend yield for {symbol}: {e}")
        return None

    def _fetch_single_irx(self) -> Optional[float]:
        try:
            ticker = yf.Ticker("^IRX")
            hist = ticker.history(period="5d")
            if hist.empty:
                return None
            price = float(hist["Close"].iloc[-1])
            return price / 100.0 if price > 0 else None
        except Exception as e:
            print(f"Failed to fetch risk-free rate: {e}")
        return None

    def _refresh_cache(self):
        for symbol in SYMBOLS:
            price = self._fetch_single_price(symbol)
            if price is not None:
                self._prices[symbol] = price
            time.sleep(1)

        for symbol in SYMBOLS:
            if symbol not in self._dividend_yields:
                dy = self._fetch_single_dividend(symbol)
                if dy is not None:
                    self._dividend_yields[symbol] = dy
                time.sleep(0.5)

        irx = self._fetch_single_irx()
        if irx is not None:
            self._irx_rate = irx

        self._cache_date = datetime.now(ET).date().isoformat()
        self._save_cache()

    def fetch_price(self, symbol: str) -> Optional[float]:
        if symbol in self._prices:
            return self._prices[symbol]
        if self._should_fetch():
            self._refresh_cache()
            return self._prices.get(symbol)
        return None

    def fetch_all_prices(self) -> Dict[str, float]:
        if self._should_fetch():
            self._refresh_cache()
        elif not self._prices:
            self._refresh_cache()
        return dict(self._prices)

    async def fetch_all_prices_async(self) -> Dict[str, float]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self.fetch_all_prices)

    def get_dividend_yield(self, symbol: str) -> float:
        if symbol in self._dividend_yields:
            return self._dividend_yields[symbol]
        return 0.0

    def get_all_dividend_yields(self) -> Dict[str, float]:
        return {s: self._dividend_yields.get(s, 0.0) for s in SYMBOLS}

    def fetch_dividend_yield(self, symbol: str) -> Optional[float]:
        if symbol in self._dividend_yields:
            return self._dividend_yields[symbol]
        return None

    def fetch_all_dividend_yields(self) -> Dict[str, float]:
        return self.get_all_dividend_yields()

    def fetch_risk_free_rate(self) -> Optional[float]:
        if self._irx_rate is not None:
            return self._irx_rate
        return None

    def get_risk_free_rate(self) -> float:
        if self._irx_rate is not None:
            return self._irx_rate
        try:
            return iv_store.get_risk_free_rate()
        except NameError:
            return DEFAULT_RISK_FREE_RATE


class IVStore:
    def __init__(self, storage_path: str = "iv_settings.json"):
        self._storage_path = Path(__file__).parent / storage_path
        self._iv: Dict[str, Dict[str, float]] = {}
        self._risk_free_rate: float = DEFAULT_RISK_FREE_RATE
        self._overrides: Dict[str, Dict[str, Dict[str, Dict[str, float]]]] = {}
        self._load()

    def _load(self):
        if self._storage_path.exists():
            try:
                data = json.loads(self._storage_path.read_text())
                for symbol in SYMBOLS:
                    if symbol in data:
                        self._iv[symbol] = {
                            "call": data[symbol].get("call", 0.20),
                            "put": data[symbol].get("put", 0.20),
                        }
                    else:
                        self._iv[symbol] = {"call": 0.20, "put": 0.20}
                self._risk_free_rate = data.get("_settings", {}).get(
                    "risk_free_rate", DEFAULT_RISK_FREE_RATE
                )
                self._overrides = data.get("_overrides", {})
            except Exception as e:
                print(f"Failed to load IV settings: {e}")
                self._init_defaults()
        else:
            self._init_defaults()
            self._save()

    def _init_defaults(self):
        for symbol in SYMBOLS:
            self._iv[symbol] = {"call": 0.20, "put": 0.20}
        self._risk_free_rate = DEFAULT_RISK_FREE_RATE
        self._overrides = {}

    def _save(self):
        data = {}
        for symbol, types in self._iv.items():
            data[symbol] = types
        data["_settings"] = {"risk_free_rate": self._risk_free_rate}
        data["_overrides"] = self._overrides
        self._storage_path.write_text(json.dumps(data, indent=2, default=str))

    def get_iv(self, symbol: str, option_type: str) -> float:
        if symbol not in self._iv:
            return 0.20
        return self._iv[symbol].get(option_type, 0.20)

    def set_iv(self, symbol: str, option_type: str, iv: float) -> None:
        if symbol not in self._iv:
            self._iv[symbol] = {}
        self._iv[symbol][option_type] = iv
        self._save()

    def get_all_iv(self) -> Dict[str, Dict[str, float]]:
        return {s: self._iv.get(s, {"call": 0.20, "put": 0.20}) for s in SYMBOLS}

    def _normalize_strike(self, strike: float) -> str:
        s = float(strike)
        if s == int(s):
            return str(int(s))
        return str(s)

    def get_contract_iv(
        self, symbol: str, expiry: str, strike: float, option_type: str
    ) -> float:
        expiry_str = str(expiry)[:10]
        strike_str = self._normalize_strike(strike)
        if symbol in self._overrides:
            if expiry_str in self._overrides[symbol]:
                if strike_str in self._overrides[symbol][expiry_str]:
                    iv_map = self._overrides[symbol][expiry_str][strike_str]
                    return iv_map.get(
                        option_type, iv_map.get("put", iv_map.get("call"))
                    )
        return self.get_iv(symbol, option_type)

    def set_contract_iv(
        self, symbol: str, expiry: str, strike: float, option_type: str, iv: float
    ) -> None:
        expiry_str = str(expiry)[:10]
        strike_str = self._normalize_strike(strike)
        if symbol not in self._overrides:
            self._overrides[symbol] = {}
        if expiry_str not in self._overrides[symbol]:
            self._overrides[symbol][expiry_str] = {}
        if strike_str not in self._overrides[symbol][expiry_str]:
            self._overrides[symbol][expiry_str][strike_str] = {
                "call": 0.20,
                "put": 0.20,
            }
        self._overrides[symbol][expiry_str][strike_str][option_type] = iv
        self._save()

    def get_overrides(self) -> Dict[str, Dict[str, Dict[str, Dict[str, float]]]]:
        return self._overrides

    def set_overrides(
        self, overrides: Dict[str, Dict[str, Dict[str, Dict[str, float]]]]
    ) -> None:
        self._overrides = overrides
        self._save()

    def get_risk_free_rate(self) -> float:
        return self._risk_free_rate

    def set_risk_free_rate(self, rate: float) -> None:
        self._risk_free_rate = rate
        self._save()

    def get_settings(self) -> dict:
        return {
            "iv": self.get_all_iv(),
            "risk_free_rate": self._risk_free_rate,
            "overrides": self._overrides,
        }

    def set_from_dict(self, data: Dict[str, Dict[str, float]]) -> None:
        for symbol, types in data.items():
            for option_type, iv in types.items():
                self.set_iv(symbol, option_type, iv)


price_service = PriceService()
iv_store = IVStore()
