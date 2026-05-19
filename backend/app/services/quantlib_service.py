import math
from datetime import date as pydate, datetime
from typing import Optional
from scipy.stats import norm
from app.models.schemas import OptionType, GreeksValues, Position, PositionSide


class QuantLibService:
    def calculate_greeks(
        self,
        option_type: OptionType,
        strike: float,
        expiration: pydate,
        spot_price: float,
        volatility: float,
        risk_free_rate: float = 0.05,
        dividend_yield: float = 0.0,
        current_date: Optional[datetime] = None,
    ) -> GreeksValues:
        if current_date is None:
            current_date = datetime.now()

        T = (expiration - current_date.date()).days / 365.0
        if T <= 0:
            return GreeksValues(
                delta=0.0,
                gamma=0.0,
                theta=0.0,
                vega=0.0,
                rho=0.0,
                charm=0.0,
                speed=0.0,
                color=0.0,
                dvega_dvol=0.0,
                vanna=0.0,
                theoretical_value=0.0,
                intrinsic_value=0.0,
                time_value=0.0,
            )

        S, K, r, q, sigma = (
            spot_price,
            strike,
            risk_free_rate,
            dividend_yield,
            volatility,
        )

        sqrt_T = math.sqrt(T)
        d1 = (math.log(S / K) + (r - q + sigma**2 / 2) * T) / (sigma * sqrt_T)
        d2 = d1 - sigma * sqrt_T

        Nd1_prime = norm.pdf(d1)
        exp_qT = math.exp(-q * T)
        exp_rT = math.exp(-r * T)

        if option_type == OptionType.CALL:
            delta = norm.cdf(d1)
            theta = (
                -S * Nd1_prime * sigma / (2 * sqrt_T) - r * S * exp_rT * norm.cdf(d2)
            ) / 365.0
            rho = S * T * exp_rT * norm.cdf(d2) / 10000.0
        else:
            delta = norm.cdf(d1) - 1
            theta = (
                -S * Nd1_prime * sigma / (2 * sqrt_T) + r * S * exp_rT * norm.cdf(-d2)
            ) / 365.0
            rho = -S * T * exp_rT * norm.cdf(-d2) / 10000.0

        gamma = Nd1_prime / (S * sigma * sqrt_T)
        vega = S * sqrt_T * Nd1_prime / 100.0

        vanna, dvega_dvol = self._calculate_vanna_volga(
            option_type, S, K, T, r, q, sigma
        )

        intrinsic = max(0, S - K) if option_type == OptionType.CALL else max(0, K - S)
        theoretical = (
            S * exp_qT * norm.cdf(d1) - K * exp_rT * norm.cdf(d2)
            if option_type == OptionType.CALL
            else K * exp_rT * norm.cdf(-d2) - S * exp_qT * norm.cdf(-d1)
        )
        time_value = theoretical - intrinsic

        return GreeksValues(
            delta=delta,
            gamma=gamma,
            theta=theta,
            vega=vega,
            rho=rho,
            charm=0.0,
            speed=0.0,
            color=0.0,
            dvega_dvol=dvega_dvol,
            vanna=vanna,
            theoretical_value=theoretical,
            intrinsic_value=intrinsic,
            time_value=time_value,
        )

    def calculate_position_greeks(
        self,
        position: Position,
        current_price: float,
        spot_price: float,
        volatility: float,
        risk_free_rate: float = 0.05,
        dividend_yield: float = 0.0,
    ) -> tuple[GreeksValues, float]:
        greeks = self.calculate_greeks(
            option_type=position.option_type,
            strike=position.strike,
            expiration=position.expiration,
            spot_price=spot_price,
            volatility=volatility,
            risk_free_rate=risk_free_rate,
            dividend_yield=dividend_yield,
        )

        multiplier = 100
        sign = 1 if position.side == PositionSide.LONG else -1
        contracts = position.quantity * sign

        premium = current_price * multiplier * abs(position.quantity)

        return GreeksValues(
            delta=greeks.delta * contracts * multiplier,
            gamma=greeks.gamma * contracts * multiplier,
            theta=greeks.theta * contracts * multiplier,
            vega=greeks.vega * contracts * multiplier,
            rho=greeks.rho * contracts * multiplier,
            charm=greeks.charm * contracts * multiplier,
            speed=greeks.speed * contracts * multiplier,
            color=greeks.color * contracts * multiplier,
            dvega_dvol=greeks.dvega_dvol * contracts * multiplier,
            vanna=greeks.vanna * contracts * multiplier,
            theoretical_value=greeks.theoretical_value * multiplier * position.quantity,
            intrinsic_value=greeks.intrinsic_value * multiplier * position.quantity,
            time_value=greeks.time_value * multiplier * position.quantity,
        ), premium

    def _calculate_vanna_volga(
        self,
        option_type: OptionType,
        spot_price: float,
        strike: float,
        T: float,
        risk_free_rate: float,
        dividend_yield: float,
        volatility: float,
    ) -> tuple[float, float]:
        if T <= 0:
            return 0.0, 0.0

        S, K, r, q, sigma = (
            spot_price,
            strike,
            risk_free_rate,
            dividend_yield,
            volatility,
        )
        sqrt_T = math.sqrt(T)

        d1 = (math.log(S / K) + (r - q + sigma**2 / 2) * T) / (sigma * sqrt_T)
        d2 = d1 - sigma * sqrt_T

        Nd1_prime = norm.pdf(d1)
        exp_qT = math.exp(-q * T)

        vanna = exp_qT * Nd1_prime * (-d2 / sigma)
        volga = S * exp_qT * Nd1_prime * sqrt_T * (d1 * d2 / sigma)

        return vanna, volga


greeks_service = QuantLibService()
