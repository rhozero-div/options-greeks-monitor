from fastapi import APIRouter, HTTPException
from typing import Optional
from app.models.schemas import (
    ScenarioRequest, ScenarioAnalysis, Scenario, ScenarioCreate,
    ScenarioUpdate, ScenarioCalculationResult, ScenarioResultItem,
    PositionResultItem, AssetType, PositionSide, SymbolShift,
)
from app.services.storage import store
from app.services.price_service import price_service, iv_store
from app.services.quantlib_service import greeks_service
from app.services.scenario_store import scenario_store

router = APIRouter(prefix="/api/v1", tags=["scenarios"])


@router.post("/scenario", response_model=ScenarioAnalysis)
async def scenario_analysis(request: ScenarioRequest, portfolio_id: Optional[str] = None):
    positions = store.get_open_positions()
    if portfolio_id:
        positions = [p for p in positions if p.portfolio_id == portfolio_id]
    if not positions:
        raise HTTPException(status_code=400, detail="No open positions")

    symbol = request.symbol.upper()
    spot_price = price_service.get_cached_price(symbol) or request.spot_price
    base_iv = request.volatility or iv_store.get_iv(symbol, "call")
    risk_free_rate = iv_store.get_risk_free_rate()

    relevant = [p for p in positions if p.symbol.upper() == symbol]
    other = [p for p in positions if p.symbol.upper() != symbol]

    scenarios = []
    for shift_pct in request.price_shifts:
        new_spot = spot_price * (1 + shift_pct / 100)
        total_current = 0.0
        total_scenario = 0.0
        net_delta = 0.0
        net_gamma = 0.0
        net_vega = 0.0
        net_theta = 0.0

        for pos in relevant:
            if pos.asset_type == AssetType.OPTION:
                pos_iv = iv_store.get_contract_iv(
                    symbol, pos.expiration, pos.strike,
                    pos.option_type.value if hasattr(pos.option_type, "value") else str(pos.option_type),
                )
                g_current = greeks_service.calculate_greeks(
                    option_type=pos.option_type, strike=pos.strike, expiration=pos.expiration,
                    spot_price=spot_price, volatility=pos_iv, risk_free_rate=risk_free_rate,
                    dividend_yield=price_service.get_dividend_yield(symbol),
                )
                g_scenario = greeks_service.calculate_greeks(
                    option_type=pos.option_type, strike=pos.strike, expiration=pos.expiration,
                    spot_price=new_spot, volatility=pos_iv, risk_free_rate=risk_free_rate,
                    dividend_yield=price_service.get_dividend_yield(symbol),
                )
                m = 100
                sign = 1 if pos.side == PositionSide.LONG else -1
                total_current += g_current.theoretical_value * m * pos.quantity * sign
                total_scenario += g_scenario.theoretical_value * m * pos.quantity * sign
                contracts = pos.quantity * sign
                net_delta += g_scenario.delta * contracts * m
                net_gamma += g_scenario.gamma * contracts * m
                net_vega += g_scenario.vega * contracts * m
                net_theta += g_scenario.theta * contracts * m
            else:
                sign = pos.quantity * (1 if pos.side == PositionSide.LONG else -1)
                total_current += spot_price * sign
                total_scenario += new_spot * sign
                net_delta += sign

        for pos in other:
            if pos.asset_type == AssetType.OPTION:
                pos_iv = iv_store.get_contract_iv(
                    pos.symbol.upper(), pos.expiration, pos.strike,
                    pos.option_type.value if hasattr(pos.option_type, "value") else str(pos.option_type),
                )
                g = greeks_service.calculate_greeks(
                    option_type=pos.option_type, strike=pos.strike, expiration=pos.expiration,
                    spot_price=price_service.get_cached_price(pos.symbol.upper()) or 100,
                    volatility=pos_iv, risk_free_rate=risk_free_rate,
                )
                m = 100
                sign = 1 if pos.side == PositionSide.LONG else -1
                total_current += g.theoretical_value * m * pos.quantity * sign
                total_scenario += g.theoretical_value * m * pos.quantity * sign
                contracts = pos.quantity * sign
                net_delta += g.delta * contracts * m
                net_gamma += g.gamma * contracts * m
            else:
                p = price_service.get_cached_price(pos.symbol.upper()) or 100
                sign = pos.quantity * (1 if pos.side == PositionSide.LONG else -1)
                total_current += p * sign
                total_scenario += p * sign

        change = total_scenario - total_current
        change_pct = (change / abs(total_current) * 100) if total_current != 0 else 0.0

        scenarios.append(ScenarioResult(
            original_price=round(spot_price, 2),
            scenario_price=round(new_spot, 2),
            price_change_pct=shift_pct,
            portfolio_value_change=round(change, 2),
            portfolio_value_change_pct=round(change_pct, 4),
            new_delta=round(net_delta, 2),
            new_gamma=round(net_gamma, 4),
            new_vega=round(net_vega, 2),
            new_theta=round(net_theta, 2),
        ))

    best = max(scenarios, key=lambda s: s.portfolio_value_change)
    worst = min(scenarios, key=lambda s: s.portfolio_value_change)

    return ScenarioAnalysis(
        symbol=request.symbol, current_spot=spot_price,
        scenarios=scenarios, best_case=best, worst_case=worst,
    )


@router.get("/scenarios", response_model=list[Scenario])
async def list_scenarios():
    return scenario_store.get_all()


@router.post("/scenarios", response_model=Scenario)
async def create_scenario(request: ScenarioCreate):
    return scenario_store.create(request)


@router.get("/scenarios/{scenario_id}", response_model=Scenario)
async def get_scenario(scenario_id: str):
    s = scenario_store.get(scenario_id)
    if not s:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return s


@router.put("/scenarios/{scenario_id}", response_model=Scenario)
async def update_scenario(scenario_id: str, request: ScenarioUpdate):
    s = scenario_store.update(scenario_id, request)
    if not s:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return s


@router.delete("/scenarios/{scenario_id}")
async def delete_scenario(scenario_id: str):
    if not scenario_store.delete(scenario_id):
        raise HTTPException(status_code=404, detail="Scenario not found")
    return {"ok": True}


@router.post("/scenario/calculate", response_model=ScenarioCalculationResult)
async def calculate_scenario(request: ScenarioCreate, portfolio_id: Optional[str] = None):
    symbols_in_scenario = list(request.shifts.keys())
    if not symbols_in_scenario:
        raise HTTPException(status_code=400, detail="At least one symbol shift required")

    base_positions = store.get_open_positions()
    if portfolio_id:
        base_positions = [p for p in base_positions if p.portfolio_id == portfolio_id]

    by_symbol = []
    portfolio_current = 0.0
    portfolio_scenario = 0.0
    portfolio_delta = 0.0
    portfolio_scenario_delta = 0.0

    for symbol, shift in request.shifts.items():
        symbol = symbol.upper()
        spot_price = price_service.get_cached_price(symbol)
        if not spot_price:
            continue

        risk_free_rate = iv_store.get_risk_free_rate()
        symbol_positions = [p for p in base_positions if p.symbol.upper() == symbol]
        if not symbol_positions:
            continue

        current_value = 0.0
        scenario_value = 0.0
        symbol_delta = 0.0
        symbol_scenario_delta = 0.0
        position_items = []

        new_spot = spot_price * (1 + shift.spot_chg)

        for pos in symbol_positions:
            if pos.asset_type == AssetType.OPTION:
                opt_type_str = pos.option_type.value if hasattr(pos.option_type, "value") else str(pos.option_type)
                iv_contract = iv_store.get_contract_iv(symbol, pos.expiration, pos.strike, opt_type_str)
                iv_scenario = iv_contract * (1 + shift.iv_chg)
                greeks_current = greeks_service.calculate_greeks(
                    option_type=pos.option_type, strike=pos.strike, expiration=pos.expiration,
                    spot_price=spot_price, volatility=iv_contract, risk_free_rate=risk_free_rate,
                    dividend_yield=price_service.get_dividend_yield(symbol),
                )
                greeks_scenario = greeks_service.calculate_greeks(
                    option_type=pos.option_type, strike=pos.strike, expiration=pos.expiration,
                    spot_price=new_spot, volatility=iv_scenario, risk_free_rate=risk_free_rate,
                    dividend_yield=price_service.get_dividend_yield(symbol),
                )
                m = 100
                sign = 1 if pos.side == PositionSide.LONG else -1
                cv = greeks_current.theoretical_value * m * pos.quantity * sign
                sv = greeks_scenario.theoretical_value * m * pos.quantity * sign
                pos_delta = greeks_current.delta * m * pos.quantity * sign
                pos_scenario_delta = greeks_scenario.delta * m * pos.quantity * sign
                current_value += cv
                scenario_value += sv
                symbol_delta += pos_delta
                symbol_scenario_delta += pos_scenario_delta
            else:
                sign = pos.quantity * (1 if pos.side == PositionSide.LONG else -1)
                cv = spot_price * sign
                sv = new_spot * sign
                pos_delta = sign
                pos_scenario_delta = sign
                current_value += cv
                scenario_value += sv
                symbol_delta += pos_delta
                symbol_scenario_delta += pos_scenario_delta

            pos_pnl = sv - cv
            pos_pnl_pct = (pos_pnl / abs(cv) * 100) if cv != 0 else 0.0
            position_items.append(PositionResultItem(
                position_id=pos.id, symbol=pos.symbol,
                asset_type=pos.asset_type.value,
                option_type=pos.option_type.value if pos.option_type else None,
                strike=pos.strike, expiration=pos.expiration.isoformat() if pos.expiration else None,
                quantity=pos.quantity, side=pos.side.value, entry_price=pos.entry_price,
                current_value=round(cv, 2), scenario_value=round(sv, 2),
                pnl=round(pos_pnl, 2), pnl_pct=round(pos_pnl_pct, 2),
                delta=round(pos_delta, 4), scenario_delta=round(pos_scenario_delta, 4),
            ))

        pnl = scenario_value - current_value
        pnl_pct = (pnl / abs(current_value) * 100) if current_value != 0 else 0.0

        by_symbol.append(ScenarioResultItem(
            symbol=symbol, current_value=round(current_value, 2),
            scenario_value=round(scenario_value, 2), pnl=round(pnl, 2),
            pnl_pct=round(pnl_pct, 2), delta=round(symbol_delta, 4),
            scenario_delta=round(symbol_scenario_delta, 4),
            by_position=position_items,
        ))
        portfolio_current += current_value
        portfolio_scenario += scenario_value
        portfolio_delta += symbol_delta
        portfolio_scenario_delta += symbol_scenario_delta

    portfolio_pnl = portfolio_scenario - portfolio_current
    portfolio_pnl_pct = (portfolio_pnl / abs(portfolio_current) * 100) if portfolio_current != 0 else 0.0

    return ScenarioCalculationResult(
        portfolio_current_value=round(portfolio_current, 2),
        portfolio_scenario_value=round(portfolio_scenario, 2),
        portfolio_pnl=round(portfolio_pnl, 2),
        portfolio_pnl_pct=round(portfolio_pnl_pct, 2),
        portfolio_delta=round(portfolio_delta, 4),
        portfolio_scenario_delta=round(portfolio_scenario_delta, 4),
        by_symbol=by_symbol,
    )
