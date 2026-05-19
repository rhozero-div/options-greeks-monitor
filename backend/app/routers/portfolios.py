from fastapi import APIRouter, HTTPException
from app.models.schemas import Portfolio, PortfolioCreate, PortfolioUpdate
from app.services.storage import portfolio_store, store

router = APIRouter(prefix="/api/v1/portfolios", tags=["portfolios"])


@router.get("", response_model=list[Portfolio])
async def list_portfolios():
    return portfolio_store.get_all()


@router.post("", response_model=Portfolio)
async def create_portfolio(request: PortfolioCreate):
    return portfolio_store.create(request)


@router.get("/{portfolio_id}", response_model=Portfolio)
async def get_portfolio(portfolio_id: str):
    p = portfolio_store.get(portfolio_id)
    if not p:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return p


@router.put("/{portfolio_id}", response_model=Portfolio)
async def update_portfolio(portfolio_id: str, request: PortfolioUpdate):
    p = portfolio_store.update(portfolio_id, request)
    if not p:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return p


@router.delete("/{portfolio_id}")
async def delete_portfolio(portfolio_id: str):
    if portfolio_id == "main":
        raise HTTPException(status_code=400, detail="Cannot delete default portfolio")
    if portfolio_store.has_positions(portfolio_id, store):
        raise HTTPException(status_code=400, detail="Portfolio has positions, remove them first")
    if not portfolio_store.delete(portfolio_id):
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return {"status": "deleted", "id": portfolio_id}
