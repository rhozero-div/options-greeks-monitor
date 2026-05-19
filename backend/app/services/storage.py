import json
import uuid
from datetime import datetime, date
from pathlib import Path
from typing import Optional
from app.models.schemas import (
    Position,
    PositionCreate,
    PositionUpdate,
    PositionStatus,
    Portfolio,
    PortfolioCreate,
    PortfolioUpdate,
)


class PositionStore:
    def __init__(self, storage_path: str = "positions.json"):
        self.storage_path = Path(storage_path)
        self._positions: dict[str, Position] = {}
        self._load()

    def _load(self):
        if self.storage_path.exists():
            try:
                data = json.loads(self.storage_path.read_text())
                for p in data.get("positions", []):
                    if p.get("expiration"):
                        p["expiration"] = __import__("datetime").date.fromisoformat(
                            p["expiration"]
                        )
                    if p.get("entry_date"):
                        p["entry_date"] = __import__("datetime").date.fromisoformat(
                            p["entry_date"]
                        )
                    self._positions[p["id"]] = Position(**p)
            except Exception as e:
                print(f"Failed to load positions: {e}")
                self._positions = {}

    def _save(self):
        data = {
            "positions": [
                {
                    **p.model_dump(),
                    "expiration": p.expiration.isoformat() if p.expiration else None,
                    "entry_date": p.entry_date.isoformat() if p.entry_date else None,
                }
                for p in self._positions.values()
            ]
        }
        self.storage_path.write_text(json.dumps(data, indent=2, default=str))

    def create(self, position: PositionCreate) -> Position:
        pos = Position(
            id=str(uuid.uuid4()),
            status=PositionStatus.OPEN,
            **position.model_dump(exclude_unset=True),
        )
        self._positions[pos.id] = pos
        self._save()
        return pos

    def get(self, id: str) -> Optional[Position]:
        return self._positions.get(id)

    def get_all(self) -> list[Position]:
        return list(self._positions.values())

    def get_open_positions(self) -> list[Position]:
        return [p for p in self._positions.values() if p.status == PositionStatus.OPEN]

    def update(self, id: str, update: PositionUpdate) -> Optional[Position]:
        pos = self._positions.get(id)
        if not pos:
            return None
        update_data = update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(pos, key, value)
        pos.updated_at = datetime.now()
        self._save()
        return pos

    def delete(self, id: str) -> bool:
        if id in self._positions:
            del self._positions[id]
            self._save()
            return True
        return False

    def clear(self):
        self._positions = {}
        self._save()


class PortfolioStore:
    def __init__(self, storage_path: str = "portfolios.json"):
        self.storage_path = Path(storage_path)
        self._portfolios: dict[str, Portfolio] = {}
        self._default_id: str = "main"
        self._load()

    def _load(self):
        if self.storage_path.exists():
            try:
                data = json.loads(self.storage_path.read_text())
                for p in data.get("portfolios", []):
                    self._portfolios[p["id"]] = Portfolio(**p)
                self._default_id = data.get("default_id", "main")
            except Exception as e:
                print(f"Failed to load portfolios: {e}")
                self._portfolios = {}
                self._create_default()

    def _save(self):
        data = {
            "portfolios": [p.model_dump() for p in self._portfolios.values()],
            "default_id": self._default_id,
        }
        self.storage_path.write_text(json.dumps(data, indent=2, default=str))

    def _create_default(self):
        default_portfolio = Portfolio(
            id="main",
            name="main",
            color="#808080",
            description="Default portfolio",
        )
        self._portfolios["main"] = default_portfolio
        self._save()

    def ensure_default(self):
        if "main" not in self._portfolios:
            self._create_default()

    def create(self, portfolio: PortfolioCreate) -> Portfolio:
        portfolio_id = portfolio.name.lower().replace(" ", "_")
        counter = 1
        original_id = portfolio_id
        while portfolio_id in self._portfolios:
            portfolio_id = f"{original_id}_{counter}"
            counter += 1
        p = Portfolio(
            id=portfolio_id,
            **portfolio.model_dump(),
        )
        self._portfolios[p.id] = p
        self._save()
        return p

    def get(self, id: str) -> Optional[Portfolio]:
        return self._portfolios.get(id)

    def get_all(self) -> list[Portfolio]:
        return list(self._portfolios.values())

    def get_default_id(self) -> str:
        if self._default_id in self._portfolios:
            return self._default_id
        return "main"

    def update(self, id: str, update: PortfolioUpdate) -> Optional[Portfolio]:
        p = self._portfolios.get(id)
        if not p:
            return None
        update_data = update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(p, key, value)
        self._save()
        return p

    def delete(self, id: str) -> bool:
        if id in self._portfolios:
            del self._portfolios[id]
            self._save()
            return True
        return False

    def has_positions(self, portfolio_id: str, position_store) -> bool:
        for pos in position_store.get_all():
            if pos.portfolio_id == portfolio_id:
                return True
        return False


portfolio_store = PortfolioStore()
store = PositionStore()
