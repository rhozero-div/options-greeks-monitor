export interface Portfolio {
  id: string;
  name: string;
  color: string;
  description: string;
  created_at: string;
}

export interface Position {
  id: string;
  portfolio_id: string;
  symbol: string;
  asset_type: "option" | "etf" | "stock";
  option_symbol: string | null;
  option_type: "call" | "put" | null;
  strike: number | null;
  expiration: string | null;
  quantity: number;
  side: "long" | "short";
  entry_price: number;
  entry_date: string | null;
  current_price: number | null;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
}

export interface GreeksPortfolio {
  total_delta: number;
  total_gamma: number;
  total_theta: number;
  total_vega: number;
  total_rho: number;
  net_delta: number;
  net_gamma: number;
  net_theta: number;
  net_vega: number;
  net_rho: number;
  etf_delta: number;
  stock_delta: number;
  total_charm: number;
  total_speed: number;
  total_color: number;
  total_dvega_dvol: number;
  total_vanna: number;
  long_contracts: number;
  short_contracts: number;
  total_contracts: number;
  etf_shares: number;
  stock_shares: number;
  total_premium: number;
  total_nominal: number;
  total_unrealized_pnl: number;
}

export interface ScenarioResult {
  scenario_price: number;
  price_change_pct: number;
  portfolio_value_change: number;
  new_delta: number;
  new_gamma: number;
  new_theta: number;
  new_vega: number;
}

export interface ScenarioAnalysis {
  symbol: string;
  current_spot: number;
  scenarios: ScenarioResult[];
  best_case: ScenarioResult | null;
  worst_case: ScenarioResult | null;
}

export interface MarketData {
  symbol: string;
  spot_price: number;
  volatility: number;
  risk_free_rate: number;
}

export interface PriceData {
  [symbol: string]: number;
}

export interface IVData {
  [symbol: string]: {
    call: number;
    put: number;
  };
}

export interface OptionGreeksDetail {
  position_id: string;
  symbol: string;
  option_type: string;
  strike: number;
  expiration: string;
  side: string;
  quantity: number;
  spot_price: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  theoretical_value: number;
  premium: number;
  entry_price: number;
  current_value: number;
  pnl: number;
}

export interface UnderlyingGreeksSummary {
  symbol: string;
  spot_price: number;
  net_delta: number;
  net_gamma: number;
  net_theta: number;
  net_vega: number;
  position_count: number;
  unrealized_pnl: number;
}

export interface EtfStockPositionDetail {
  position_id: string;
  symbol: string;
  asset_type: string;
  side: string;
  quantity: number;
  spot_price: number;
  entry_price: number;
  current_value: number;
  pnl: number;
  delta: number;
}

export interface GreeksDetailResponse {
  options: OptionGreeksDetail[];
  underlyings: UnderlyingGreeksSummary[];
  etf_stocks: EtfStockPositionDetail[];
  timestamp: string;
}

export interface AggregatedScenarioPoint {
  spot: number;
  pct: number;
  total_value: number;
  net_delta: number;
  net_gamma: number;
  net_vega: number;
  net_theta: number;
  net_vanna: number;
  net_volga: number;
}

export interface PositionScenarioDetail {
  strike: number;
  option_type: string;
  side: string;
  quantity: number;
  scenarios: {
    spot: number;
    pct: number;
    value: number;
    delta: number;
    gamma: number;
    vega: number;
    theta: number;
  }[];
}

export interface SensitivityResponse {
  symbol: string;
  base_spot: number;
  iv_call: number;
  iv_put: number;
  positions: PositionScenarioDetail[];
  aggregated: AggregatedScenarioPoint[];
}

export interface Sensitivity3DResponse {
  symbol: string;
  base_spot: number;
  base_iv_call: number;
  base_iv_put: number;
  spot_values: number[];
  iv_values: number[];
  value_matrix: number[][];
  delta_matrix: number[][];
  gamma_matrix: number[][];
  vega_matrix: number[][];
  theta_matrix: number[][];
  vanna_matrix: number[][];
  volga_matrix: number[][];
}

export interface AggregatedIVScenarioPoint {
  iv: number;
  iv_pct: number;
  total_value: number;
  net_delta: number;
  net_gamma: number;
  net_vega: number;
  net_theta: number;
  net_vanna: number;
  net_volga: number;
}

export interface SensitivityIVResponse {
  symbol: string;
  base_spot: number;
  base_iv_call: number;
  base_iv_put: number;
  iv_values: number[];
  aggregated: AggregatedIVScenarioPoint[];
}

export interface SymbolShift {
  spot_chg: number;
  iv_chg: number;
}

export interface Scenario {
  id: string;
  name: string;
  shifts: { [symbol: string]: SymbolShift };
  created_at: string;
  updated_at: string;
}

export interface PositionResultItem {
  position_id: string;
  symbol: string;
  asset_type: string;
  option_type: string | null;
  strike: number | null;
  expiration: string | null;
  quantity: number;
  side: string;
  entry_price: number;
  current_value: number;
  scenario_value: number;
  pnl: number;
  pnl_pct: number;
delta: number;
  scenario_delta: number;
}

export interface ScenarioResultItem {
  symbol: string;
  current_value: number;
  scenario_value: number;
  pnl: number;
  pnl_pct: number;
  delta: number;
  scenario_delta: number;
  by_position: PositionResultItem[];
}

export interface ScenarioCalculationResult {
  portfolio_current_value: number;
  portfolio_scenario_value: number;
  portfolio_pnl: number;
  portfolio_pnl_pct: number;
  portfolio_delta: number;
  portfolio_scenario_delta: number;
  by_symbol: ScenarioResultItem[];
}

export interface ScenarioCalculationResult {
  portfolio_current_value: number;
  portfolio_scenario_value: number;
  portfolio_pnl: number;
  portfolio_pnl_pct: number;
  portfolio_delta: number;
  by_symbol: ScenarioResultItem[];
}
