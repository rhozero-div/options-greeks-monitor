from datetime import datetime
from app.models.schemas import (
    GreeksPortfolio, GreeksValues, PositionSide, AssetType, OptionType,
)
from app.services.storage import store
from app.services.price_service import price_service, iv_store
from app.services.quantlib_service import greeks_service


def calculate_portfolio_greeks(portfolio_id: str | None = None) -> GreeksPortfolio:
    positions = store.get_open_positions()
    if portfolio_id:
        positions = [p for p in positions if p.portfolio_id == portfolio_id]
    prices = price_service.get_all_cached_prices()

    if not positions:
        return GreeksPortfolio(
            total_delta=0, total_gamma=0, total_theta=0, total_vega=0, total_rho=0,
            net_delta=0, net_gamma=0, net_theta=0, net_vega=0, net_rho=0,
            etf_delta=0.0, stock_delta=0.0, etf_shares=0, stock_shares=0,
            total_unrealized_pnl=0.0,
        )

    option_positions = [p for p in positions if p.asset_type == AssetType.OPTION]
    etf_positions = [p for p in positions if p.asset_type == AssetType.ETF]
    stock_positions = [p for p in positions if p.asset_type == AssetType.STOCK]

    totals = {
        "long": _empty_totals(),
        "short": _empty_totals(),
        "premium": 0.0, "nominal": 0.0, "unrealized_pnl": 0.0,
    }

    etf_delta = 0.0
    stock_delta = 0.0

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

        key = "long" if pos.side == PositionSide.LONG else "short"
        _add_greeks(totals[key], greeks)
        totals["premium"] += premium
        totals["nominal"] += pos.strike * 100 * abs(pos.quantity)
        cv = greeks.theoretical_value
        entry_value = pos.entry_price * 100 * pos.quantity
        current_value = -cv if pos.side == PositionSide.SHORT else cv
        if pos.side == PositionSide.SHORT:
            totals["unrealized_pnl"] += entry_value - abs(current_value)
        else:
            totals["unrealized_pnl"] += current_value - entry_value

    for pos in etf_positions:
        symbol = pos.symbol.upper()
        spot_price = prices.get(symbol, 100.0)
        multiplier = pos.quantity * (1 if pos.side == PositionSide.LONG else -1)
        etf_delta += multiplier
        totals["premium"] += spot_price * abs(pos.quantity)
        pnl = (spot_price - pos.entry_price) * abs(pos.quantity)
        if pos.side == PositionSide.SHORT:
            pnl = -pnl
        totals["unrealized_pnl"] += pnl

    for pos in stock_positions:
        symbol = pos.symbol.upper()
        spot_price = prices.get(symbol, 100.0)
        multiplier = pos.quantity * (1 if pos.side == PositionSide.LONG else -1)
        stock_delta += multiplier
        totals["premium"] += spot_price * abs(pos.quantity)
        pnl = (spot_price - pos.entry_price) * abs(pos.quantity)
        if pos.side == PositionSide.SHORT:
            pnl = -pnl
        totals["unrealized_pnl"] += pnl

    option_net = {
        "delta": totals["long"]["delta"] + totals["short"]["delta"],
        "gamma": totals["long"]["gamma"] + totals["short"]["gamma"],
        "theta": totals["long"]["theta"] + totals["short"]["theta"],
        "vega": totals["long"]["vega"] + totals["short"]["vega"],
        "rho": totals["long"]["rho"] + totals["short"]["rho"],
        "charm": totals["long"]["charm"] + totals["short"]["charm"],
        "speed": totals["long"]["speed"] + totals["short"]["speed"],
        "color": totals["long"]["color"] + totals["short"]["color"],
        "dvega_dvol": totals["long"]["dvega_dvol"] + totals["short"]["dvega_dvol"],
        "vanna": totals["long"]["vanna"] + totals["short"]["vanna"],
    }

    return GreeksPortfolio(
        total_delta=option_net["delta"] + etf_delta + stock_delta,
        total_gamma=option_net["gamma"],
        total_theta=option_net["theta"],
        total_vega=option_net["vega"],
        total_rho=option_net["rho"],
        total_charm=option_net["charm"],
        total_speed=option_net["speed"],
        total_color=option_net["color"],
        total_dvega_dvol=option_net["dvega_dvol"],
        total_vanna=option_net["vanna"],
        net_delta=option_net["delta"] + etf_delta + stock_delta,
        net_gamma=option_net["gamma"],
        net_theta=option_net["theta"],
        net_vega=option_net["vega"],
        net_rho=option_net["rho"],
        etf_delta=etf_delta, stock_delta=stock_delta,
        long_contracts=sum(p.quantity for p in option_positions if p.side == PositionSide.LONG),
        short_contracts=sum(p.quantity for p in option_positions if p.side == PositionSide.SHORT),
        total_contracts=sum(p.quantity for p in option_positions),
        etf_shares=sum(p.quantity for p in etf_positions),
        stock_shares=sum(p.quantity for p in stock_positions),
        total_premium=totals["premium"],
        total_nominal=totals["nominal"],
        total_unrealized_pnl=totals.get("unrealized_pnl", 0.0),
    )


def _empty_totals():
    return {
        "delta": 0, "gamma": 0, "theta": 0, "vega": 0, "rho": 0,
        "charm": 0, "speed": 0, "color": 0, "dvega_dvol": 0, "vanna": 0,
    }


def _add_greeks(totals: dict, greeks: GreeksValues):
    totals["delta"] += greeks.delta
    totals["gamma"] += greeks.gamma
    totals["theta"] += greeks.theta
    totals["vega"] += greeks.vega
    totals["rho"] += greeks.rho
    totals["charm"] += greeks.charm
    totals["speed"] += greeks.speed
    totals["color"] += greeks.color
    totals["dvega_dvol"] += greeks.dvega_dvol
    totals["vanna"] += greeks.vanna
