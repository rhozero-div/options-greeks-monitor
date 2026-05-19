from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime
from app.models.schemas import (
    GreeksPortfolio, GreeksDetailResponse, OptionGreeksDetail,
    UnderlyingGreeksSummary, EtfStockPositionDetail,
    AssetType, PositionSide, OptionType, SensitivityRequest,
    SensitivityResponse, PositionScenarioDetail, AggregatedScenarioPoint,
    Sensitivity3DRequest, Sensitivity3DResponse,
    SensitivityIVRequest, SensitivityIVResponse, AggregatedIVScenarioPoint,
)
from app.services.storage import store
from app.services.price_service import price_service, iv_store
from app.services.quantlib_service import greeks_service

router = APIRouter(prefix="/api/v1", tags=["greeks"])


@router.post("/greeks", response_model=GreeksPortfolio)
async def get_portfolio_greeks(portfolio_id: Optional[str] = None):
    from app.services.portfolio_service import calculate_portfolio_greeks
    return calculate_portfolio_greeks(portfolio_id)


@router.get("/greeks/detail", response_model=GreeksDetailResponse)
async def get_greeks_detail(portfolio_id: Optional[str] = None):
    from app.models.schemas import PositionSide

    positions = store.get_open_positions()
    if portfolio_id:
        positions = [p for p in positions if p.portfolio_id == portfolio_id]
    prices = price_service.get_all_cached_prices()

    option_positions = [p for p in positions if p.asset_type == AssetType.OPTION]
    etf_stk_positions = [
        p for p in positions if p.asset_type in (AssetType.ETF, AssetType.STOCK)
    ]

    options_detail = []
    underlying_summary = {}
    etf_stocks_detail = []

    for pos in option_positions:
        symbol = pos.symbol.upper()
        spot_price = prices.get(symbol, 100.0)
        iv = iv_store.get_contract_iv(
            symbol, pos.expiration, pos.strike,
            pos.option_type.value if hasattr(pos.option_type, "value") else pos.option_type,
        )
        current_price = pos.current_price or (spot_price * 0.05)
        risk_free_rate = iv_store.get_risk_free_rate()
        greeks, premium = greeks_service.calculate_position_greeks(
            position=pos, current_price=current_price, spot_price=spot_price,
            volatility=iv, risk_free_rate=risk_free_rate,
        )

        opt_type = pos.option_type.value if hasattr(pos.option_type, "value") else pos.option_type
        side = pos.side.value if hasattr(pos.side, "value") else pos.side
        cv = greeks.theoretical_value
        current_value = -cv if pos.side == PositionSide.SHORT else cv
        pnl = (pos.entry_price * 100 * pos.quantity - abs(current_value)) if pos.side == PositionSide.SHORT else (current_value - pos.entry_price * 100 * pos.quantity)

        options_detail.append(OptionGreeksDetail(
            position_id=pos.id, symbol=symbol, option_type=opt_type,
            strike=pos.strike, expiration=pos.expiration.isoformat() if hasattr(pos.expiration, "isoformat") else str(pos.expiration),
            side=side, quantity=pos.quantity, spot_price=spot_price, iv=iv,
            delta=greeks.delta, gamma=greeks.gamma, theta=greeks.theta,
            vega=greeks.vega, rho=greeks.rho, vanna=greeks.vanna, volga=greeks.dvega_dvol,
            theoretical_value=greeks.theoretical_value, premium=premium,
            entry_price=pos.entry_price, current_value=current_value, pnl=pnl,
        ))

        if symbol not in underlying_summary:
            underlying_summary[symbol] = {"symbol": symbol, "spot_price": spot_price,
                "net_delta": 0.0, "net_gamma": 0.0, "net_theta": 0.0, "net_vega": 0.0,
                "position_count": 0, "unrealized_pnl": 0.0}
        underlying_summary[symbol]["net_delta"] += greeks.delta
        underlying_summary[symbol]["net_gamma"] += greeks.gamma
        underlying_summary[symbol]["net_theta"] += greeks.theta
        underlying_summary[symbol]["net_vega"] += greeks.vega
        underlying_summary[symbol]["position_count"] += 1
        underlying_summary[symbol]["unrealized_pnl"] += pnl

    for pos in etf_stk_positions:
        symbol = pos.symbol.upper()
        spot_price = prices.get(symbol, 100.0)
        multiplier = 1
        delta = pos.quantity * multiplier * (1 if pos.side == PositionSide.LONG else -1)
        pnl = (spot_price - pos.entry_price) * pos.quantity * (1 if pos.side == PositionSide.LONG else -1)
        asset_type_str = pos.asset_type.value if hasattr(pos.asset_type, "value") else str(pos.asset_type)
        side_str = pos.side.value if hasattr(pos.side, "value") else str(pos.side)

        etf_stocks_detail.append(EtfStockPositionDetail(
            position_id=pos.id, symbol=symbol, asset_type=asset_type_str,
            side=side_str, quantity=pos.quantity, spot_price=spot_price,
            entry_price=pos.entry_price, current_value=spot_price * pos.quantity, pnl=pnl, delta=delta,
        ))

        if symbol not in underlying_summary:
            underlying_summary[symbol] = {"symbol": symbol, "spot_price": spot_price,
                "net_delta": 0.0, "net_gamma": 0.0, "net_theta": 0.0, "net_vega": 0.0,
                "position_count": 0, "unrealized_pnl": 0.0}
        underlying_summary[symbol]["net_delta"] += delta
        underlying_summary[symbol]["position_count"] += 1
        underlying_summary[symbol]["unrealized_pnl"] += pnl

    return GreeksDetailResponse(
        options=options_detail,
        underlyings=[UnderlyingGreeksSummary(**v) for v in underlying_summary.values()],
        etf_stocks=etf_stocks_detail,
        timestamp=datetime.now().isoformat(),
    )


@router.post("/sensitivity", response_model=SensitivityResponse)
async def get_sensitivity(request: SensitivityRequest, portfolio_id: Optional[str] = None):
    symbol = request.symbol.upper()
    spot_price = price_service.get_cached_price(symbol)
    if not spot_price:
        raise HTTPException(status_code=400, detail=f"Price not available for {symbol}")

    base_positions = store.get_open_positions()
    if portfolio_id:
        base_positions = [p for p in base_positions if p.portfolio_id == portfolio_id]

    option_positions = [p for p in base_positions if p.symbol.upper() == symbol and p.asset_type == AssetType.OPTION]
    etf_stk_positions = [p for p in base_positions if p.symbol.upper() == symbol and p.asset_type != AssetType.OPTION]

    risk_free_rate = iv_store.get_risk_free_rate()

    pct_values = []
    current_pct = request.min_pct
    while current_pct <= request.max_pct + 1e-6:
        pct_values.append(current_pct)
        current_pct += request.step_pct

    spot_values = [spot_price * (1 + pct / 100) for pct in pct_values]

    aggregated_scenarios = []
    for spot, pct in zip(spot_values, pct_values):
        total_value = 0.0
        net_delta = 0.0
        net_gamma = 0.0
        net_vega = 0.0
        net_theta = 0.0
        net_vanna = 0.0
        net_volga = 0.0

        for pos in option_positions:
            iv = iv_store.get_contract_iv(symbol, pos.expiration, pos.strike, pos.option_type.value if hasattr(pos.option_type, "value") else str(pos.option_type))
            greeks = greeks_service.calculate_greeks(
                option_type=pos.option_type, strike=pos.strike, expiration=pos.expiration,
                spot_price=spot, volatility=iv, risk_free_rate=risk_free_rate,
                dividend_yield=price_service.get_dividend_yield(symbol),
            )
            contracts = pos.quantity * (1 if pos.side == PositionSide.LONG else -1)
            multiplier = 100
            opt_value = greeks.theoretical_value * multiplier * pos.quantity
            if pos.side == PositionSide.SHORT:
                opt_value = -opt_value
            total_value += opt_value
            net_delta += greeks.delta * contracts * multiplier
            net_gamma += greeks.gamma * contracts * multiplier
            net_vega += greeks.vega * contracts * multiplier
            net_theta += greeks.theta * contracts * multiplier
            net_vanna += greeks.vanna * contracts * multiplier
            net_volga += greeks.dvega_dvol * contracts * multiplier

        for pos in etf_stk_positions:
            total_value += pos.quantity * spot * (1 if pos.side == PositionSide.LONG else -1)
            net_delta += pos.quantity * (1 if pos.side == PositionSide.LONG else -1)

        aggregated_scenarios.append(AggregatedScenarioPoint(
            spot=round(spot, 2), pct=round(pct, 2), total_value=round(total_value, 2),
            net_delta=round(net_delta, 4), net_gamma=round(net_gamma, 6),
            net_vega=round(net_vega, 4), net_theta=round(net_theta, 4),
            net_vanna=round(net_vanna, 4), net_volga=round(net_volga, 4),
        ))

    position_scenarios = []
    for pos in option_positions:
        scenarios = []
        pos_iv = iv_store.get_contract_iv(symbol, pos.expiration, pos.strike, pos.option_type.value if hasattr(pos.option_type, "value") else str(pos.option_type))
        for spot, pct in zip(spot_values, pct_values):
            greeks = greeks_service.calculate_greeks(
                option_type=pos.option_type, strike=pos.strike, expiration=pos.expiration,
                spot_price=spot, volatility=pos_iv, risk_free_rate=risk_free_rate,
                dividend_yield=price_service.get_dividend_yield(symbol),
            )
            contracts = pos.quantity * (1 if pos.side == PositionSide.LONG else -1)
            multiplier = 100
            scenarios.append({
                "spot": round(spot, 2), "pct": round(pct, 2),
                "value": round(greeks.theoretical_value * multiplier * pos.quantity * (-1 if pos.side == PositionSide.SHORT else 1), 2),
                "delta": round(greeks.delta * contracts * multiplier, 4),
                "gamma": round(greeks.gamma * contracts * multiplier, 6),
                "vega": round(greeks.vega * contracts * multiplier, 4),
                "theta": round(greeks.theta * contracts * multiplier, 4),
            })
        position_scenarios.append(PositionScenarioDetail(
            strike=pos.strike, option_type=pos.option_type.value if pos.option_type else "",
            side=pos.side.value if pos.side else "", quantity=pos.quantity, scenarios=scenarios,
        ))

    return SensitivityResponse(
        symbol=symbol, base_spot=round(spot_price, 2),
        iv_call=iv_store.get_iv(symbol, "call"), iv_put=iv_store.get_iv(symbol, "put"),
        positions=position_scenarios, aggregated=aggregated_scenarios,
    )


@router.post("/sensitivity-3d", response_model=Sensitivity3DResponse)
async def get_sensitivity_3d(request: Sensitivity3DRequest, portfolio_id: Optional[str] = None):
    symbol = request.symbol.upper()
    spot_price = price_service.get_cached_price(symbol)
    if not spot_price:
        raise HTTPException(status_code=400, detail=f"Price not available for {symbol}")

    base_positions = store.get_open_positions()
    if portfolio_id:
        base_positions = [p for p in base_positions if p.portfolio_id == portfolio_id]

    option_positions = [p for p in base_positions if p.symbol.upper() == symbol and p.asset_type == AssetType.OPTION]
    etf_stk_positions = [p for p in base_positions if p.symbol.upper() == symbol and p.asset_type != AssetType.OPTION]

    risk_free_rate = iv_store.get_risk_free_rate()

    spot_pct_values = []
    current = request.min_spot_pct
    while current <= request.max_spot_pct + 1e-6:
        spot_pct_values.append(round(current, 2))
        current += request.spot_step_pct

    iv_pct_values = []
    current = request.min_iv_pct
    while current <= request.max_iv_pct + 1e-6:
        iv_pct_values.append(round(current, 2))
        current += request.iv_step_pct

    spot_values = [round(spot_price * (1 + pct / 100), 2) for pct in spot_pct_values]
    rep_iv = iv_store.get_contract_iv(
        symbol,
        option_positions[0].expiration if option_positions else None,
        option_positions[0].strike if option_positions else 0,
        option_positions[0].option_type.value if option_positions else "put",
    ) if option_positions else iv_store.get_iv(symbol, "put")
    iv_values = [round(rep_iv * (1 + pct / 100), 4) for pct in iv_pct_values]

    matrices = {"value": [], "delta": [], "gamma": [], "vega": [], "theta": [], "vanna": [], "volga": []}

    for iv_pct in iv_pct_values:
        iv_sweep = rep_iv * (1 + iv_pct / 100)
        row = {k: [] for k in matrices}
        for spot in spot_values:
            total_value = 0.0
            nd = ng = nv = nt = nva = nvo = 0.0
            for pos in option_positions:
                pos_iv = iv_store.get_contract_iv(symbol, pos.expiration, pos.strike, pos.option_type.value if hasattr(pos.option_type, "value") else str(pos.option_type))
                greeks = greeks_service.calculate_greeks(
                    option_type=pos.option_type, strike=pos.strike, expiration=pos.expiration,
                    spot_price=spot, volatility=pos_iv * (1 + iv_pct / 100),
                    risk_free_rate=risk_free_rate, dividend_yield=price_service.get_dividend_yield(symbol),
                )
                contracts = pos.quantity * (1 if pos.side == PositionSide.LONG else -1)
                m = 100
                opt_value = greeks.theoretical_value * m * pos.quantity
                if pos.side == PositionSide.SHORT:
                    opt_value = -opt_value
                total_value += opt_value
                nd += greeks.delta * contracts * m
                ng += greeks.gamma * contracts * m
                nv += greeks.vega * contracts * m
                nt += greeks.theta * contracts * m
                nva += greeks.vanna * contracts * m
                nvo += greeks.dvega_dvol * contracts * m
            for pos in etf_stk_positions:
                total_value += pos.quantity * spot * (1 if pos.side == PositionSide.LONG else -1)
                nd += pos.quantity * (1 if pos.side == PositionSide.LONG else -1)
            row["value"].append(round(total_value, 2))
            row["delta"].append(round(nd, 4))
            row["gamma"].append(round(ng, 6))
            row["vega"].append(round(nv, 4))
            row["theta"].append(round(nt, 4))
            row["vanna"].append(round(nva, 4))
            row["volga"].append(round(nvo, 4))
        for k in matrices:
            matrices[k].append(row[k])

    return Sensitivity3DResponse(
        symbol=symbol, base_spot=round(spot_price, 2),
        base_iv_call=iv_store.get_iv(symbol, "call"), base_iv_put=iv_store.get_iv(symbol, "put"),
        spot_values=spot_values, iv_values=iv_values,
        value_matrix=matrices["value"], delta_matrix=matrices["delta"],
        gamma_matrix=matrices["gamma"], vega_matrix=matrices["vega"],
        theta_matrix=matrices["theta"], vanna_matrix=matrices["vanna"],
        volga_matrix=matrices["volga"],
    )


@router.post("/sensitivity-iv", response_model=SensitivityIVResponse)
async def get_sensitivity_iv(request: SensitivityIVRequest, portfolio_id: Optional[str] = None):
    symbol = request.symbol.upper()
    spot_price = price_service.get_cached_price(symbol)
    if not spot_price:
        raise HTTPException(status_code=400, detail=f"Price not available for {symbol}")

    base_positions = store.get_open_positions()
    if portfolio_id:
        base_positions = [p for p in base_positions if p.portfolio_id == portfolio_id]

    option_positions = [p for p in base_positions if p.symbol.upper() == symbol and p.asset_type == AssetType.OPTION]
    etf_stk_positions = [p for p in base_positions if p.symbol.upper() == symbol and p.asset_type != AssetType.OPTION]

    risk_free_rate = iv_store.get_risk_free_rate()
    rep_iv = iv_store.get_contract_iv(
        symbol,
        option_positions[0].expiration if option_positions else None,
        option_positions[0].strike if option_positions else 0,
        option_positions[0].option_type.value if option_positions else "put",
    ) if option_positions else iv_store.get_iv(symbol, "put")

    iv_pct_values = []
    current = -20.0
    while current <= 20.0 + 1e-6:
        iv_pct_values.append(round(current, 2))
        current += 2.0

    iv_values = [round(rep_iv * (1 + pct / 100), 4) for pct in iv_pct_values]

    aggregated = []
    for iv_pct in iv_pct_values:
        iv_sweep = rep_iv * (1 + iv_pct / 100)
        total_value = 0.0
        net_delta = net_gamma = net_vega = net_theta = net_vanna = net_volga = 0.0
        for pos in option_positions:
            pos_iv = iv_store.get_contract_iv(symbol, pos.expiration, pos.strike, pos.option_type.value if hasattr(pos.option_type, "value") else str(pos.option_type))
            greeks = greeks_service.calculate_greeks(
                option_type=pos.option_type, strike=pos.strike, expiration=pos.expiration,
                spot_price=spot_price, volatility=pos_iv * (1 + iv_pct / 100),
                risk_free_rate=risk_free_rate, dividend_yield=price_service.get_dividend_yield(symbol),
            )
            contracts = pos.quantity * (1 if pos.side == PositionSide.LONG else -1)
            m = 100
            opt_value = greeks.theoretical_value * m * pos.quantity
            if pos.side == PositionSide.SHORT:
                opt_value = -opt_value
            total_value += opt_value
            net_delta += greeks.delta * contracts * m
            net_gamma += greeks.gamma * contracts * m
            net_vega += greeks.vega * contracts * m
            net_theta += greeks.theta * contracts * m
            net_vanna += greeks.vanna * contracts * m
            net_volga += greeks.dvega_dvol * contracts * m
        for pos in etf_stk_positions:
            total_value += pos.quantity * spot_price * (1 if pos.side == PositionSide.LONG else -1)
            net_delta += pos.quantity * (1 if pos.side == PositionSide.LONG else -1)
        aggregated.append(AggregatedIVScenarioPoint(
            iv=round(iv_sweep, 4), iv_pct=iv_pct, total_value=round(total_value, 2),
            net_delta=round(net_delta, 4), net_gamma=round(net_gamma, 6),
            net_vega=round(net_vega, 4), net_theta=round(net_theta, 4),
            net_vanna=round(net_vanna, 4), net_volga=round(net_volga, 4),
        ))

    return SensitivityIVResponse(
        symbol=symbol, base_spot=round(spot_price, 2),
        base_iv_call=iv_store.get_iv(symbol, "call"), base_iv_put=iv_store.get_iv(symbol, "put"),
        iv_values=iv_values, aggregated=aggregated,
    )
