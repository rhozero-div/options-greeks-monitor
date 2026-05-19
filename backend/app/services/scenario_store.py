import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional
from app.models.schemas import Scenario, ScenarioCreate, ScenarioUpdate, SymbolShift


class ScenarioStore:
    def __init__(self, storage_path: str = "scenarios.json"):
        self.storage_path = Path(storage_path)
        self._scenarios: dict[str, Scenario] = {}
        self._load()

    def _load(self):
        if self.storage_path.exists():
            try:
                data = json.loads(self.storage_path.read_text())
                for s in data.get("scenarios", []):
                    shifts = {
                        sym: SymbolShift(**shift_data)
                        for sym, shift_data in s.get("shifts", {}).items()
                    }
                    self._scenarios[s["id"]] = Scenario(
                        id=s["id"],
                        name=s["name"],
                        shifts=shifts,
                        created_at=datetime.fromisoformat(s["created_at"]),
                        updated_at=datetime.fromisoformat(s["updated_at"]),
                    )
            except Exception as e:
                print(f"Failed to load scenarios: {e}")
                self._scenarios = {}

    def _save(self):
        data = {
            "scenarios": [
                {
                    "id": s.id,
                    "name": s.name,
                    "shifts": {
                        sym: shift.model_dump() for sym, shift in s.shifts.items()
                    },
                    "created_at": s.created_at.isoformat(),
                    "updated_at": s.updated_at.isoformat(),
                }
                for s in self._scenarios.values()
            ]
        }
        self.storage_path.write_text(json.dumps(data, indent=2, default=str))

    def create(self, scenario: ScenarioCreate) -> Scenario:
        now = datetime.now()
        s = Scenario(
            id=str(uuid.uuid4()),
            name=scenario.name,
            shifts=scenario.shifts,
            created_at=now,
            updated_at=now,
        )
        self._scenarios[s.id] = s
        self._save()
        return s

    def get(self, id: str) -> Optional[Scenario]:
        return self._scenarios.get(id)

    def get_all(self) -> list[Scenario]:
        return list(self._scenarios.values())

    def update(self, id: str, update: ScenarioUpdate) -> Optional[Scenario]:
        s = self._scenarios.get(id)
        if not s:
            return None
        if update.name is not None:
            s.name = update.name
        if update.shifts is not None:
            s.shifts = update.shifts
        s.updated_at = datetime.now()
        self._save()
        return s

    def delete(self, id: str) -> bool:
        if id in self._scenarios:
            del self._scenarios[id]
            self._save()
            return True
        return False


scenario_store = ScenarioStore()
