import yfinance as yf
import json
from typing import Dict, Optional
from datetime import datetime, timedelta
from pathlib import Path

SYMBOLS = ["VOO", "QQQ", "GLD", "USO", "TLT"]
DEFAULT_RISK_FREE_RATE = 0.05


class PriceService:
    def __init__(self, cache_file: str = "daily_close_cache.json"):
        self._data_dir = Path(__file__).parent
        self._cache_file = self._data_dir / cache_file
        self._prices: Dict[str, float] = {}
        self._dividend_yields: Dict[str, float] = {}
        self._irx_rate: Optional[float] = None
        self._cache_date: Optional[str] = None
        self._load_cache()

    def _load_cache(self):
        if self._cache_file.exists():
            try:
                data = json.loads(self._cache_file.read_text())
                self._cache_date = data.get("date")
                today = datetime.now().date().isoformat()
                if self._cache_date == today:
                    self._prices = data.get("prices", {})
                    self._dividend_yields = data.get("dividend_yields", {})
                    self._irx_rate = data.get("irx_rate")
                    print(f"Loaded cached daily close prices for {self._cache_date}")
                else:
                    print(f"Cache stale ({self._cache_date}), will fetch on first request")
                    self._prices = {}
                    self._cache_date = None
            except Exception as e:
                print(f"Failed to load price cache: {e}")
                self._prices = {}
                self._cache_date = None

    def _save_cache(self):
        data = {
            "date": datetime.now().date().isoformat(),
            "prices": self._prices,
            "dividend_yields": self._dividend_yields,
            "irx_rate": self._irx_rate,
        }
        self._cache_file.write_text(json.dumps(data, indent=2, default=str))
        self._cache_date = datetime.now().date().isoformat()

    def _needs_daily_refresh(self) -> bool:
        return self._cache_date != datetime.now().date().isoformat()

    def fetch_price(self, symbol: str) -> Optional[float]:
        if symbol in self._prices and not self._needs_daily_refresh():
            return self._prices[symbol]
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.fast_info
            price = info.get("lastPrice")
            if price and price > 0:
                self._prices[symbol] = float(price)
                self._save_cache()
                return float(price)
        except Exception as e:
            print(f"Failed to fetch price for {symbol}: {e}")
        return self._prices.get(symbol)

    def fetch_all_prices(self) -> Dict[str, float]:
        results = {}
        for symbol in SYMBOLS:
            price = self.fetch_price(symbol)
            if price:
                results[symbol] = price
        return results

    def get_cached_price(self, symbol: str) -> Optional[float]:
        return self._prices.get(symbol)

    def get_all_cached_prices(self) -> Dict[str, float]:
        return {s: self._prices[s] for s in SYMBOLS if s in self._prices}

    def get_last_update_time(self, symbol: str) -> Optional[str]:
        return self._cache_date

    def fetch_dividend_yield(self, symbol: str) -> Optional[float]:
        if symbol in self._dividend_yields and not self._needs_daily_refresh():
            return self._dividend_yields[symbol]
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            dividend_yield = info.get("dividendYield")
            if dividend_yield is not None and dividend_yield > 0:
                dividend_yield_decimal = float(dividend_yield) / 100.0
                self._dividend_yields[symbol] = dividend_yield_decimal
                return dividend_yield_decimal
        except Exception as e:
            print(f"Failed to fetch dividend yield for {symbol}: {e}")
        return None

    def get_dividend_yield(self, symbol: str) -> float:
        if symbol in self._dividend_yields:
            return self._dividend_yields[symbol]
        yield_value = self.fetch_dividend_yield(symbol)
        if yield_value is not None:
            return yield_value
        return 0.0

    def get_all_dividend_yields(self) -> Dict[str, float]:
        return {s: self._dividend_yields.get(s, 0.0) for s in SYMBOLS}

    def fetch_all_dividend_yields(self) -> Dict[str, float]:
        for symbol in SYMBOLS:
            self.fetch_dividend_yield(symbol)
        return self.get_all_dividend_yields()

    def fetch_risk_free_rate(self) -> Optional[float]:
        if self._irx_rate is not None and not self._needs_daily_refresh():
            return self._irx_rate
        try:
            ticker = yf.Ticker("^IRX")
            info = ticker.info
            rate = info.get("previousClose") or info.get("lastPrice")
            if rate and rate > 0:
                self._irx_rate = float(rate) / 100.0
                self._save_cache()
                return self._irx_rate
        except Exception as e:
            print(f"Failed to fetch risk-free rate from ^IRX: {e}")
        return None

    def get_risk_free_rate(self) -> float:
        rate = self.fetch_risk_free_rate()
        if rate is not None:
            return rate
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
