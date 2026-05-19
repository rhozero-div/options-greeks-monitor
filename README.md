<<<<<<< HEAD
# options-greeks-monitor
a simple option greeks monitor
=======
# Options Greeks Monitor

A web-based options portfolio Greeks calculator and monitoring tool. Built with FastAPI (Python) + Next.js 16 (React/TypeScript).

**Price data**: yfinance `history()` — fetches daily close prices once after US market close (≥4:00 PM ET). No real-time polling. All network calls run in a thread pool to avoid blocking the event loop.

## Features

- **Greeks Dashboard** — Delta, Gamma, Theta, Vega, Rho, Vanna, Volga, Charm, Speed, Color at portfolio level
- **Position Management** — Add/edit/close option (call/put), ETF, and stock positions across portfolios
- **Sensitivity Analysis** — 2D spot sweep, IV sweep, and 3D surface (Spot × IV) with Plotly heatmap
- **Scenario Analysis** — What-if analysis with full Black-Scholes repricing
- **Daily Close Pricing** — Fetches once per trading day after market close; caches to `daily_close_cache.json`
- **Portfolio Management** — Multi-portfolio support with per-portfolio Greeks
- **IV Settings** — Per-symbol and per-contract implied volatility overrides, persisted to `iv_settings.json`
- **WebSocket Push** — Auto-push Greek updates on page load and manual refresh

## Architecture

```
frontend/ (Next.js 16, port 3011)
  │
  │  API proxy: /api/* → localhost:8742/api/*

  Python Backend (FastAPI, port 8742)
  │
  ├── Greeks Engine (analytic Black-Scholes, scipy)
  ├── Sensitivity (2D spot/IV sweeps, 3D surface)
  ├── Scenario (full BS repricing with spot + IV shifts)
  ├── Position / Portfolio CRUD (JSON-persisted)
  ├── IV Store (JSON-persisted)
  ├── Daily Close Cache (yfinance history(), run_in_executor)
  └── WebSocket manager (/ws/greeks)
```

## Quick Start

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # edit if needed
uvicorn app.main:app --port 8742
```

### Frontend

```bash
cd frontend
npm install
npx next dev -p 3011
```

Open http://localhost:3011

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | `*` | Allowed CORS origins (comma-separated) |

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/health` | GET | Health check |
| `/api/v1/prices` | GET | All cached daily close prices |
| `/api/v1/prices/{symbol}` | GET | Single symbol cached price |
| `/api/v1/iv` | GET | IV settings (per-symbol call/put) |
| `/api/v1/iv/{symbol}/{option_type}` | PUT | Set IV for a symbol |
| `/api/v1/iv/overrides` | GET/PUT | Per-contract IV overrides |
| `/api/v1/settings` | GET | Combined IV + dividend + risk-free rate |
| `/api/v1/positions` | GET/POST | List / create positions |
| `/api/v1/positions/{id}` | GET/PATCH/DELETE | Single position CRUD |
| `/api/v1/positions/close/{id}` | POST | Close position with exit price |
| `/api/v1/greeks` | POST | Portfolio-level Greeks aggregation |
| `/api/v1/greeks/detail` | GET | Per-option + per-underlying + ETF Greeks detail |
| `/api/v1/sensitivity` | POST | 2D spot sensitivity sweep |
| `/api/v1/sensitivity-iv` | POST | IV sensitivity sweep |
| `/api/v1/sensitivity-3d` | POST | 3D Spot × IV surface |
| `/api/v1/scenarios` | GET/POST | Saved scenario CRUD |
| `/api/v1/scenario/calculate` | POST | Full BS scenario repricing |
| `/api/v1/portfolios` | GET/POST | Portfolio CRUD |
| `/ws/greeks` | WebSocket | Real-time Greeks push (subscribe/refresh) |

## Greeks Reference

All Greeks are computed using the **analytic Black-Scholes-Merton** model (European options, continuous dividend yield).

### Notation

| Symbol | Meaning |
|--------|---------|
| $S$ | Spot price of underlying |
| $K$ | Strike price |
| $T$ | Time to expiry (years) |
| $r$ | Risk-free rate (13-week T-bill) |
| $q$ | Dividend yield |
| $\sigma$ | Implied volatility |
| $\Phi$ | Standard normal CDF |
| $\phi$ | Standard normal PDF |

$$
d_1 = \frac{\ln(S/K) + (r - q + \sigma^2/2)T}{\sigma\sqrt{T}}, \quad
d_2 = d_1 - \sigma\sqrt{T}
$$

### Primary Greeks

| Greek | Symbol | Formula | Description | Unit |
|-------|--------|---------|-------------|------|
| **Delta** | $\Delta$ | $\Phi(d_1)$ (call), $\Phi(d_1)-1$ (put) | Option price sensitivity to \$1 change in spot | \$ per \$1 |
| **Gamma** | $\Gamma$ | $\displaystyle\frac{\phi(d_1)}{S \sigma \sqrt{T}}$ | Delta sensitivity to \$1 change in spot | \$ per \$1² |
| **Theta** | $\Theta$ | $\displaystyle\frac{-S\phi(d_1)\sigma}{2\sqrt{T}} \mp r K e^{-rT}\Phi(\pm d_2)$ | Daily time decay (negative for long options) | \$ per day |
| **Vega** | $\nu$ | $\displaystyle\frac{S \sqrt{T} \phi(d_1)}{100}$ | Option price sensitivity to 1pp volatility change | \$ per 1% IV |
| **Rho** | $\rho$ | $\pm K T e^{-rT}\Phi(\pm d_2)$ (call/put) | Option price sensitivity to 1bp rate change | \$ per bps |

*Theta sign convention: $ -S\phi(d_1)\sigma / (2\sqrt{T})$ for both call/put, then $- r K e^{-rT}\Phi(d_2)$ for call, $+ r K e^{-rT}\Phi(-d_2)$ for put. All divided by 365 for daily value.*

*Rho sign convention: $+ST e^{-rT}\Phi(d_2)$ for call, $-ST e^{-rT}\Phi(-d_2)$ for put. Divided by 10,000 for basis points.*

### Second-Order Greeks

| Greek | Symbol | Formula | Description | Unit |
|-------|--------|---------|-------------|------|
| **Vanna** | $\displaystyle\frac{\partial\Delta}{\partial\sigma}$ | $e^{-qT} \phi(d_1) \cdot (-d_2 / \sigma)$ | Delta sensitivity to volatility change (= Vega sensitivity to spot change) | \$ per 1% vol |
| **Volga** (DvegaDvol) | $\displaystyle\frac{\partial\nu}{\partial\sigma}$ | $S e^{-qT} \phi(d_1) \sqrt{T} \cdot (d_1 d_2 / \sigma)$ | Vega sensitivity to volatility change | \$ per 1% vol |

### Third-Order Greeks

| Greek | Symbol | Formula | Description |
|-------|--------|---------|-------------|
| **Charm** ($\Delta_t$) | $\displaystyle\frac{\partial\Delta}{\partial t}$ | Delta decay over time (not currently computed — returns 0) |
| **Speed** ($\Gamma_S$) | $\displaystyle\frac{\partial\Gamma}{\partial S}$ | Gamma change per \$1 move (not currently computed — returns 0) |
| **Color** ($\Gamma_t$) | $\displaystyle\frac{\partial\Gamma}{\partial t}$ | Gamma decay over time (not currently computed — returns 0) |

*Charm, Speed, and Color are reserved for future implementation. They are exposed in the API and frontend but currently return 0.*

### Position-Level Greeks

For each position, Greeks are scaled by:
- **Multiplier**: 100 (standard options contract)
- **Quantity**: absolute number of contracts
- **Direction**: +1 for long, −1 for short

```
Position Greek = Single-option Greek × contracts × multiplier × sign
```

Portfolio-level Greeks are summed across all open positions.

### Additional Metrics

| Metric | Calculation |
|--------|-------------|
| **Premium** | Entry price × 100 × \|quantity\| |
| **Unrealized P&L** | For short: entry_value − \|current_value\|; for long: \|current_value\| − entry_value |
| **Nominal Exposure** | Strike × 100 × \|quantity\| |

## Data Pipeline

```
┌─ cache_date == today ──→ return cached prices (zero network)
│
on request ─┤
            └─ cache_date ≠ today ──┐
                                    ├─ <16:00 ET → return None (market open, don't fetch)
                                    └─ ≥16:00 ET → run_in_executor:
                                                    ├─ VOO history("1d")["Close"]
                                                    ├─ QQQ history("1d")["Close"]
                                                    ├─ GLD history("1d")["Close"]
                                                    ├─ USO history("1d")["Close"]
                                                    ├─ TLT history("1d")["Close"]
                                                    ├─ ^IRX history("5d")["Close"]
                                                    ├─ dividend yield (ticker.info)
                                                    └─ save to daily_close_cache.json
```

All yfinance calls run in a `ThreadPoolExecutor` so the event loop is never blocked.

## Contribute

1. Fork the repo
2. Create a feature branch
3. Submit a PR

## License

MIT
>>>>>>> 0ef2790 (Initial release: Options Greeks Monitor v1.0.0)
