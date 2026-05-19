from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import date, datetime
from enum import Enum


class OptionType(str, Enum):
    CALL = "call"
    PUT = "put"


class PositionSide(str, Enum):
    LONG = "long"
    SHORT = "short"


class TradeAction(str, Enum):
    OPEN = "open"
    CLOSE = "close"


class PositionStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"


class AssetType(str, Enum):
    OPTION = "option"
    ETF = "etf"
    STOCK = "stock"


class PortfolioBase(BaseModel):
    name: str = Field(description="Portfolio name, e.g., Main Account")
    color: str = Field(default="#808080", description="Hex color for UI display")
    description: str = Field(default="", description="Optional notes")


class PortfolioCreate(PortfolioBase):
    pass


class PortfolioUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None


class Portfolio(PortfolioBase):
    id: str
    created_at: datetime = Field(default_factory=datetime.now)

    class Config:
        from_attributes = True


class PositionBase(BaseModel):
    portfolio_id: str = Field(
        default="main", description="Portfolio ID this position belongs to"
    )
    symbol: str = Field(description="Underlying symbol, e.g., SPY, VOO")
    asset_type: AssetType = Field(
        default=AssetType.OPTION, description="Asset type: option, etf, or stock"
    )
    option_symbol: Optional[str] = Field(
        default=None, description="Full option symbol, e.g., SPY240315C500"
    )
    option_type: Optional[OptionType] = Field(
        default=None, description="Call or Put (only for options)"
    )
    strike: Optional[float] = Field(
        default=None, description="Strike price (only for options)"
    )
    expiration: Optional[date] = Field(
        default=None, description="Expiration date (only for options)"
    )
    quantity: int = Field(
        description="Number of contracts (options) or shares (etf/stock)"
    )
    side: PositionSide
    entry_price: float = Field(description="Entry price per share/unit")
    entry_date: Optional[date] = Field(default=None, description="Entry date")


class PositionCreate(PositionBase):
    pass


class PositionUpdate(BaseModel):
    portfolio_id: Optional[str] = None
    symbol: Optional[str] = None
    asset_type: Optional[AssetType] = None
    option_symbol: Optional[str] = None
    option_type: Optional[OptionType] = None
    strike: Optional[float] = None
    expiration: Optional[date] = None
    quantity: Optional[int] = None
    side: Optional[PositionSide] = None
    entry_price: Optional[float] = None
    entry_date: Optional[date] = None
    current_price: Optional[float] = None
    status: Optional[PositionStatus] = None


class Position(PositionBase):
    id: str
    status: PositionStatus = PositionStatus.OPEN
    current_price: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Config:
        from_attributes = True


class GreeksValues(BaseModel):
    delta: float = Field(
        description="Delta: change in option value per $1 change in underlying"
    )
    gamma: float = Field(
        description="Gamma: change in delta per $1 change in underlying"
    )
    theta: float = Field(description="Theta: change in option value per day")
    vega: float = Field(description="Vega: change in option value per 1% change in IV")
    rho: float = Field(
        description="Rho: change in option value per 1% change in interest rate"
    )

    # Secondary Greeks
    charm: float = Field(default=0.0, description="Charm: delta decay over time")
    speed: float = Field(default=0.0, description="Speed: gamma change per $1")
    color: float = Field(default=0.0, description="Color: gamma decay over time")
    dvega_dvol: float = Field(
        default=0.0, description="DvegaDvol: vega change per vol change"
    )
    vanna: float = Field(default=0.0, description="Vanna: delta change per vol change")

    # Calculated values
    theoretical_value: float = Field(
        default=0.0, description="Black-Scholes theoretical price"
    )
    intrinsic_value: float = Field(default=0.0, description="Intrinsic value")
    time_value: float = Field(default=0.0, description="Time value")


class GreeksPortfolio(BaseModel):
    total_delta: float
    total_gamma: float
    total_theta: float
    total_vega: float
    total_rho: float

    # Net position Greeks (long - short)
    net_delta: float
    net_gamma: float
    net_theta: float
    net_vega: float
    net_rho: float

    # ETF/Stock delta contribution
    etf_delta: float = 0.0
    stock_delta: float = 0.0

    # Secondary
    total_charm: float = 0.0
    total_speed: float = 0.0
    total_color: float = 0.0
    total_dvega_dvol: float = 0.0
    total_vanna: float = 0.0

    # Position counts
    long_contracts: int = 0
    short_contracts: int = 0
    total_contracts: int = 0
    etf_shares: int = 0
    stock_shares: int = 0

    # Exposure
    total_premium: float = 0.0
    total_nominal: float = 0.0
    total_unrealized_pnl: float = 0.0


class ScenarioRequest(BaseModel):
    symbol: str
    spot_price: Optional[float] = None
    volatility: Optional[float] = None
    days_to_expiration: Optional[int] = None
    risk_free_rate: Optional[float] = None

    price_shifts: list[float] = Field(
        default_factory=lambda: [-10, -5, -2, -1, 1, 2, 5, 10],
        description="Percentage price shifts for what-if",
    )


class ScenarioResult(BaseModel):
    original_price: float
    scenario_price: float
    price_change_pct: float
    portfolio_value_change: float
    portfolio_value_change_pct: float
    new_delta: float
    new_gamma: float
    new_theta: float
    new_vega: float


class ScenarioAnalysis(BaseModel):
    symbol: str
    current_spot: float
    scenarios: list[ScenarioResult]
    best_case: Optional[ScenarioResult] = None
    worst_case: Optional[ScenarioResult] = None


class SensitivityRequest(BaseModel):
    symbol: str
    min_pct: float = Field(default=-50, description="Min spot shift percentage")
    max_pct: float = Field(default=50, description="Max spot shift percentage")
    step_pct: float = Field(default=5, description="Step percentage")


class PositionScenarioDetail(BaseModel):
    strike: float
    option_type: str
    side: str
    quantity: int
    scenarios: list[dict]


class AggregatedScenarioPoint(BaseModel):
    spot: float
    pct: float
    total_value: float
    net_delta: float
    net_gamma: float
    net_vega: float
    net_theta: float
    net_vanna: float = 0.0
    net_volga: float = 0.0


class SensitivityResponse(BaseModel):
    symbol: str
    base_spot: float
    iv_call: float
    iv_put: float
    positions: list[PositionScenarioDetail]
    aggregated: list[AggregatedScenarioPoint]


class OptionGreeksDetail(BaseModel):
    position_id: str
    symbol: str
    option_type: str
    strike: float
    expiration: str
    side: str
    quantity: int
    spot_price: float
    iv: float
    delta: float
    gamma: float
    theta: float
    vega: float
    rho: float
    vanna: float
    volga: float
    theoretical_value: float
    premium: float
    entry_price: float
    current_value: float
    pnl: float


class UnderlyingGreeksSummary(BaseModel):
    symbol: str
    spot_price: float
    net_delta: float
    net_gamma: float
    net_theta: float
    net_vega: float
    position_count: int
    unrealized_pnl: float = 0.0


class EtfStockPositionDetail(BaseModel):
    position_id: str
    symbol: str
    asset_type: str
    side: str
    quantity: int
    spot_price: float
    entry_price: float
    current_value: float
    pnl: float
    delta: float


class GreeksDetailResponse(BaseModel):
    options: list[OptionGreeksDetail]
    underlyings: list[UnderlyingGreeksSummary]
    etf_stocks: list[EtfStockPositionDetail]
    timestamp: str


class Sensitivity3DRequest(BaseModel):
    symbol: str
    min_spot_pct: float = Field(default=-50, description="Min spot shift percentage")
    max_spot_pct: float = Field(default=50, description="Max spot shift percentage")
    spot_step_pct: float = Field(default=5, description="Spot step percentage")
    min_iv_pct: float = Field(default=-20, description="Min IV shift percentage")
    max_iv_pct: float = Field(default=20, description="Max IV shift percentage")
    iv_step_pct: float = Field(default=2, description="IV step percentage")


class Sensitivity3DResponse(BaseModel):
    symbol: str
    base_spot: float
    base_iv_call: float
    base_iv_put: float
    spot_values: list[float]
    iv_values: list[float]
    value_matrix: list[list[float]]
    delta_matrix: list[list[float]]
    gamma_matrix: list[list[float]]
    vega_matrix: list[list[float]]
    theta_matrix: list[list[float]]
    vanna_matrix: list[list[float]] = []
    volga_matrix: list[list[float]] = []


class SensitivityIVRequest(BaseModel):
    symbol: str


class AggregatedIVScenarioPoint(BaseModel):
    iv: float
    iv_pct: float
    total_value: float
    net_delta: float
    net_gamma: float
    net_vega: float
    net_theta: float
    net_vanna: float = 0.0
    net_volga: float = 0.0


class SensitivityIVResponse(BaseModel):
    symbol: str
    base_spot: float
    base_iv_call: float
    base_iv_put: float
    iv_values: list[float]
    aggregated: list[AggregatedIVScenarioPoint]


class SymbolShift(BaseModel):
    spot_chg: float = Field(
        default=0.0, description="Spot change fraction (e.g., -0.15 for -15%)"
    )
    iv_chg: float = Field(
        default=0.0, description="IV change fraction (e.g., -0.20 for -20%)"
    )


class ScenarioCreate(BaseModel):
    name: str
    shifts: dict[str, SymbolShift] = Field(default_factory=dict)


class ScenarioUpdate(BaseModel):
    name: Optional[str] = None
    shifts: Optional[dict[str, SymbolShift]] = None


class Scenario(BaseModel):
    id: str
    name: str
    shifts: dict[str, SymbolShift]
    created_at: datetime
    updated_at: datetime


class PositionResultItem(BaseModel):
    position_id: str
    symbol: str
    asset_type: str
    option_type: Optional[str] = None
    strike: Optional[float] = None
    expiration: Optional[str] = None
    quantity: int
    side: str
    entry_price: float
    current_value: float
    scenario_value: float
    pnl: float
    pnl_pct: float
    delta: float = 0.0
    scenario_delta: float = 0.0


class ScenarioResultItem(BaseModel):
    symbol: str
    current_value: float
    scenario_value: float
    pnl: float
    pnl_pct: float
    delta: float = 0.0
    scenario_delta: float = 0.0
    by_position: list[PositionResultItem] = []


class ScenarioCalculationResult(BaseModel):
    portfolio_current_value: float
    portfolio_scenario_value: float
    portfolio_pnl: float
    portfolio_pnl_pct: float
    portfolio_delta: float = 0.0
    portfolio_scenario_delta: float = 0.0
    by_symbol: list[ScenarioResultItem]
