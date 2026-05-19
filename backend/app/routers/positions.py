from fastapi import APIRouter, HTTPException
from typing import Optional
from app.models.schemas import Position, PositionCreate, PositionUpdate, PositionStatus
from app.services.storage import store

router = APIRouter(prefix="/api/v1/positions", tags=["positions"])


@router.post("", response_model=Position)
async def create_position(position: PositionCreate):
    return store.create(position)


@router.get("", response_model=list[Position])
async def get_positions(status: Optional[str] = None, portfolio_id: Optional[str] = None):
    positions = store.get_all()
    if status == "open":
        positions = [p for p in positions if p.status == PositionStatus.OPEN]
    if portfolio_id:
        positions = [p for p in positions if p.portfolio_id == portfolio_id]
    return positions


@router.get("/{position_id}", response_model=Position)
async def get_position(position_id: str):
    pos = store.get(position_id)
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
    return pos


@router.patch("/{position_id}", response_model=Position)
async def update_position(position_id: str, update: PositionUpdate):
    pos = store.update(position_id, update)
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
    return pos


@router.delete("/{position_id}")
async def delete_position(position_id: str):
    if not store.delete(position_id):
        raise HTTPException(status_code=404, detail="Position not found")
    return {"status": "deleted", "id": position_id}


@router.post("/close/{position_id}", response_model=Position)
async def close_position(position_id: str, exit_price: float):
    pos = store.update(
        position_id,
        PositionUpdate(status=PositionStatus.CLOSED, current_price=exit_price),
    )
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
    return pos


@router.delete("")
async def clear_positions():
    store.clear()
    return {"status": "cleared"}
