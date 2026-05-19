import math
import pytest
from datetime import date, datetime
from app.models.schemas import OptionType, PositionSide, Position, PositionCreate, GreeksValues
from app.services.quantlib_service import QuantLibService

service = QuantLibService()
TOLERANCE = 1e-10


class TestBlackScholesGreeks:
    """Verify Greeks against known analytic values."""

    S = 100.0        # spot
    K = 100.0        # ATM strike
    r = 0.05         # risk-free rate
    sigma = 0.20     # IV
    q = 0.0          # dividend yield
    T_days = 365     # 1 year to expiry
    T = T_days / 365.0
    expiry = date(2027, 5, 19)

    @property
    def greeks_call(self):
        return service.calculate_greeks(
            option_type=OptionType.CALL,
            strike=self.K,
            expiration=self.expiry,
            spot_price=self.S,
            volatility=self.sigma,
            risk_free_rate=self.r,
            dividend_yield=self.q,
            current_date=datetime(2026, 5, 19),
        )

    @property
    def greeks_put(self):
        return service.calculate_greeks(
            option_type=OptionType.PUT,
            strike=self.K,
            expiration=self.expiry,
            spot_price=self.S,
            volatility=self.sigma,
            risk_free_rate=self.r,
            dividend_yield=self.q,
            current_date=datetime(2026, 5, 19),
        )

    def test_delta_call_atm(self):
        """ATM call delta should be ~0.5-0.6 (close to N(d1) ≈ 0.55 for 1Y ATM)."""
        d = self.greeks_call.delta
        assert 0.4 < d < 0.7, f"ATM call delta={d} out of range"

    def test_delta_put_atm(self):
        """ATM put delta should be ~ -(1 - call_delta)."""
        d = self.greeks_put.delta
        assert -0.6 < d < -0.3, f"ATM put delta={d} out of range"

    def test_call_put_delta_parity(self):
        """Call delta - put delta ≈ 1 (for same strike, no div)."""
        diff = self.greeks_call.delta - self.greeks_put.delta
        assert abs(diff - 1.0) < 0.01, f"Call-put delta parity={diff}"

    def test_gamma_positive(self):
        """Gamma is always positive for both calls and puts."""
        assert self.greeks_call.gamma > 0
        assert self.greeks_put.gamma > 0

    def test_gamma_equal_call_put(self):
        """Gamma is identical for call and put at same strike."""
        assert abs(self.greeks_call.gamma - self.greeks_put.gamma) < TOLERANCE

    def test_vega_positive(self):
        """Vega is always positive for both calls and puts."""
        assert self.greeks_call.vega > 0
        assert self.greeks_put.vega > 0

    def test_vega_equal_call_put(self):
        """Vega is identical for call and put at same strike."""
        assert abs(self.greeks_call.vega - self.greeks_put.vega) < TOLERANCE

    def test_theta_negative_call(self):
        """ATM call theta is typically negative (time decay costs)."""
        assert self.greeks_call.theta < 0

    def test_rho_call_positive(self):
        """Call rho is positive (higher rates increase call value)."""
        assert self.greeks_call.rho > 0

    def test_rho_put_negative(self):
        """Put rho is negative (higher rates decrease put value)."""
        assert self.greeks_put.rho < 0

    def test_theoretical_value_call(self):
        """ATM call with 1Y expiry should have value > 0."""
        assert self.greeks_call.theoretical_value > 0

    def test_theoretical_value_put(self):
        """ATM put with 1Y expiry should have value > 0."""
        assert self.greeks_put.theoretical_value > 0

    def test_intrinsic_value(self):
        intrinsic_call = self.greeks_call.intrinsic_value
        intrinsic_put = self.greeks_put.intrinsic_value
        assert intrinsic_call >= 0
        assert intrinsic_put >= 0

    def test_time_value_positive(self):
        """Time value should be positive for ATM options."""
        assert self.greeks_call.time_value > 0
        assert self.greeks_put.time_value > 0

    def test_vanna_volga_nonzero(self):
        """Vanna and Volga should be non-zero for ATM options."""
        assert self.greeks_call.vanna != 0
        assert self.greeks_call.dvega_dvol != 0


class TestPositionGreeks:
    """Verify position-level Greeks scaling."""

    def _make_position(self, side: PositionSide, qty: int, option_type: OptionType = OptionType.CALL) -> Position:
        return Position(
            id="test",
            portfolio_id="main",
            symbol="TEST",
            asset_type="option",
            option_type=option_type,
            strike=100.0,
            expiration=date(2027, 5, 19),
            quantity=qty,
            side=side,
            entry_price=10.0,
        )

    def test_long_call_delta_positive(self):
        pos = self._make_position(PositionSide.LONG, 1, OptionType.CALL)
        greeks, _ = service.calculate_position_greeks(
            position=pos, current_price=5.0, spot_price=100.0,
            volatility=0.2, risk_free_rate=0.05,
        )
        assert greeks.delta > 0

    def test_short_call_delta_negative(self):
        pos = self._make_position(PositionSide.SHORT, 1, OptionType.CALL)
        greeks, _ = service.calculate_position_greeks(
            position=pos, current_price=5.0, spot_price=100.0,
            volatility=0.2, risk_free_rate=0.05,
        )
        assert greeks.delta < 0

    def test_long_put_delta_negative(self):
        pos = self._make_position(PositionSide.LONG, 1, OptionType.PUT)
        greeks, _ = service.calculate_position_greeks(
            position=pos, current_price=5.0, spot_price=100.0,
            volatility=0.2, risk_free_rate=0.05,
        )
        assert greeks.delta < 0

    def test_short_put_delta_positive(self):
        pos = self._make_position(PositionSide.SHORT, 1, OptionType.PUT)
        greeks, _ = service.calculate_position_greeks(
            position=pos, current_price=5.0, spot_price=100.0,
            volatility=0.2, risk_free_rate=0.05,
        )
        assert greeks.delta > 0

    def test_delta_scales_with_qty(self):
        pos1 = self._make_position(PositionSide.LONG, 1, OptionType.CALL)
        pos2 = self._make_position(PositionSide.LONG, 2, OptionType.CALL)
        g1, _ = service.calculate_position_greeks(
            position=pos1, current_price=5.0, spot_price=100.0,
            volatility=0.2, risk_free_rate=0.05,
        )
        g2, _ = service.calculate_position_greeks(
            position=pos2, current_price=5.0, spot_price=100.0,
            volatility=0.2, risk_free_rate=0.05,
        )
        assert abs(g2.delta - 2 * g1.delta) < TOLERANCE


class TestGreeksEdgeCases:
    """Edge cases: expired/zero expiry, deep ITM/OTM."""

    def test_expired_option(self):
        expiry = date(2020, 1, 1)  # in the past
        greeks = service.calculate_greeks(
            option_type=OptionType.CALL, strike=100.0, expiration=expiry,
            spot_price=100.0, volatility=0.2, risk_free_rate=0.05,
            current_date=datetime(2026, 5, 19),
        )
        assert greeks.delta == 0.0
        assert greeks.gamma == 0.0
        assert greeks.vega == 0.0
        assert greeks.theoretical_value == 0.0

    def test_deep_itm_call(self):
        """Deep ITM call delta ≈ 1, gamma ≈ 0."""
        greeks = service.calculate_greeks(
            option_type=OptionType.CALL, strike=50.0, expiration=date(2027, 5, 19),
            spot_price=200.0, volatility=0.2, risk_free_rate=0.05,
            current_date=datetime(2026, 5, 19),
        )
        assert abs(greeks.delta - 1.0) < 0.01
        assert abs(greeks.gamma) < 0.001

    def test_deep_otm_call(self):
        """Deep OTM call delta ≈ 0, gamma ≈ 0."""
        greeks = service.calculate_greeks(
            option_type=OptionType.CALL, strike=200.0, expiration=date(2027, 5, 19),
            spot_price=50.0, volatility=0.2, risk_free_rate=0.05,
            current_date=datetime(2026, 5, 19),
        )
        assert abs(greeks.delta) < 0.01
        assert abs(greeks.gamma) < 0.001

    def test_zero_volatility(self):
        """With zero vol, option is either ITM (intrinsic) or OTM (zero)."""
        greeks = service.calculate_greeks(
            option_type=OptionType.CALL, strike=100.0, expiration=date(2027, 5, 19),
            spot_price=100.0, volatility=1e-10, risk_free_rate=0.05,
            current_date=datetime(2026, 5, 19),
        )
        gamma = service.calculate_greeks(
            option_type=OptionType.CALL, strike=100.0, expiration=date(2027, 5, 19),
            spot_price=100.0, volatility=1e-10, risk_free_rate=0.05,
            current_date=datetime(2026, 5, 19),
        )
        assert gamma.gamma >= 0  # Gamma should not crash
