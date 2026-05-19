<<<<<<< HEAD
# options-greeks-monitor
a simple option greeks monitor
=======
# Options Greeks Monitor

A web-based options portfolio Greeks calculator and monitoring tool. Built with FastAPI (Python) + Next.js (React/TypeScript).

## Features

- **Greeks Dashboard** — Delta, Gamma, Theta, Vega, Rho, Vanna, Volga at portfolio level
- **Position Management** — Add/edit/close option, ETF, and stock positions in portfolios
- **Sensitivity Analysis** — 2D spot/IV sweeps and 3D surface (Spot × IV) with Plotly visualization
- **Scenario Analysis** — What-if analysis with full Black-Scholes repricing
- **Daily Close Pricing** — Fetches once per trading day via yfinance (no real-time polling)
- **Portfolio Management** — Multi-portfolio support with per-portfolio Greeks
- **IV Settings** — Per-symbol and per-contract implied volatility overrides

## Architecture

```
frontend/  ←→  Python Backend (FastAPI, port 8000)
  Next.js 16      │
  port 3011       ├── Greeks (analytic BS, scipy)
                  ├── Sensitivity (2D/3D)
                  ├── Scenario (full repricing)
                  ├── Position/Portfolio CRUD
                  ├── IV Store (JSON-persisted)
                  └── Daily Close Cache (yfinance)
```

## Quick Start

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # edit if needed
uvicorn app.main:app --reload --port 8000
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
| `CORS_ORIGINS` | `*` | Allowed origins (comma-separated) |
| `RISK_FREE_RATE` | `0.05` | Fallback risk-free rate |

## API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/prices` | GET | All prices (cached daily close) |
| `/api/v1/iv` | GET | IV settings |
| `/api/v1/positions` | GET/POST | List/create positions |
| `/api/v1/greeks` | POST | Portfolio Greeks |
| `/api/v1/greeks/detail` | GET | Per-option + per-underlying Greeks |
| `/api/v1/sensitivity` | POST | 2D spot sensitivity |
| `/api/v1/sensitivity-3d` | POST | 3D Spot × IV surface |
| `/api/v1/scenarios` | GET/POST | Scenario CRUD |
| `/api/v1/scenario/calculate` | POST | Full BS scenario repricing |
| `/api/v1/portfolios` | GET/POST | Portfolio CRUD |
| `/ws/greeks` | WebSocket | Subscribe to Greeks updates |

## Greeks Model

- **Model**: Black-Scholes-Merton (analytic, scipy.stats.norm)
- **Assumptions**: European options, constant volatility
- **Primary Greeks**: Delta, Gamma, Theta, Vega, Rho
- **Secondary Greeks**: Vanna, Volga

## License

MIT
>>>>>>> 0ef2790 (Initial release: Options Greeks Monitor v1.0.0)
