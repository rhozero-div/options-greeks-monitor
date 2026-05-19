from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

from app.services.storage import portfolio_store, store
from app.models.schemas import PositionUpdate
from app.routers import positions, greeks, scenarios, portfolios, prices, ws


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Options Greeks Monitor API started")
    portfolio_store.ensure_default()
    for pos in store.get_all():
        if not pos.portfolio_id:
            store.update(pos.id, PositionUpdate(portfolio_id="main"))
    yield
    print("Options Greeks Monitor API shutdown")


app = FastAPI(
    title="Options Greeks Monitor API",
    description="Daily close-based options Greeks calculation and portfolio monitoring",
    version="1.0.0",
    lifespan=lifespan,
)

cors_origins = os.getenv("CORS_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins.split(",") if cors_origins != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(positions.router)
app.include_router(greeks.router)
app.include_router(scenarios.router)
app.include_router(portfolios.router)
app.include_router(prices.router)
app.include_router(ws.router)


@app.get("/")
async def root():
    return {"status": "running", "service": "Options Greeks Monitor API"}


@app.get("/api/v1/health")
async def health():
    from datetime import datetime
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
