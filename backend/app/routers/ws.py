from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
from datetime import datetime
from app.services.price_service import price_service, iv_store
from app.services.portfolio_service import calculate_portfolio_greeks

router = APIRouter(tags=["websocket"])


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


@router.websocket("/ws/greeks")
async def websocket_greeks(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")

            if msg_type == "subscribe":
                prices = price_service.get_all_cached_prices()
                iv_data = iv_store.get_all_iv()
                greeks = calculate_portfolio_greeks()
                await websocket.send_json({
                    "type": "greeks_update",
                    "prices": prices,
                    "iv": iv_data,
                    "data": greeks.model_dump(),
                    "timestamp": datetime.now().isoformat(),
                })

            elif msg_type == "refresh":
                prices = price_service.get_all_cached_prices()
                iv_data = iv_store.get_all_iv()
                greeks = calculate_portfolio_greeks()
                await websocket.send_json({
                    "type": "greeks_update",
                    "prices": prices,
                    "iv": iv_data,
                    "data": greeks.model_dump(),
                    "timestamp": datetime.now().isoformat(),
                })

            elif msg_type == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now().isoformat(),
                })

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)
