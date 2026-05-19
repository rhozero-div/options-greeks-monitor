from fastapi import APIRouter, HTTPException
from datetime import datetime
from app.services.price_service import price_service, iv_store

router = APIRouter(prefix="/api/v1", tags=["prices"])


@router.get("/prices")
async def get_prices():
    prices = price_service.fetch_all_prices()
    return {"prices": prices, "timestamp": datetime.now().isoformat()}


@router.get("/prices/{symbol}")
async def get_price(symbol: str):
    price = price_service.fetch_price(symbol.upper())
    if price is None:
        raise HTTPException(status_code=404, detail=f"Price not available for {symbol}")
    return {"symbol": symbol.upper(), "price": price, "timestamp": datetime.now().isoformat()}


@router.get("/iv")
async def get_all_iv():
    return {"iv": iv_store.get_all_iv()}


@router.get("/iv/overrides")
async def get_iv_overrides():
    return {"overrides": iv_store.get_overrides()}


@router.put("/iv/overrides")
async def set_iv_overrides(overrides: dict):
    iv_store.set_overrides(overrides.get("overrides", {}))
    return {"status": "saved", "overrides": iv_store.get_overrides()}


@router.put("/iv/{symbol}/{option_type}")
async def set_iv(symbol: str, option_type: str, iv: float):
    if option_type not in ["call", "put"]:
        raise HTTPException(status_code=400, detail="option_type must be 'call' or 'put'")
    if iv <= 0 or iv > 5:
        raise HTTPException(status_code=400, detail="IV must be between 0 and 5")
    iv_store.set_iv(symbol.upper(), option_type, iv)
    return {"symbol": symbol.upper(), "option_type": option_type, "iv": iv}


@router.get("/settings")
async def get_settings():
    settings = iv_store.get_settings()
    settings["dividend_yields"] = price_service.fetch_all_dividend_yields()
    settings["risk_free_rate_irx"] = price_service.fetch_risk_free_rate()
    settings["risk_free_rate_fallback"] = iv_store.get_risk_free_rate()
    return settings


@router.put("/settings/risk_free_rate")
async def set_risk_free_rate(rate: float):
    if rate < 0 or rate > 1:
        raise HTTPException(status_code=400, detail="Risk-free rate must be between 0 and 1")
    iv_store.set_risk_free_rate(rate)
    return {"risk_free_rate": rate}
