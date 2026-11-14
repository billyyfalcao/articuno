"""HTTP adapter for the PY-04 local registry, not a Java client."""
from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import AwareDatetime, BaseModel, Field

from app.events import CameraMap, EventRegistry, Identifier, Observation, VisionEvent
from app.java_client import JavaClient, DeliveryLedger, DeliveryResult, DeliverySettings


class SimulationRequest(Observation):
    operation_id: Identifier
    detected_at: AwareDatetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source: Literal['ASSISTED', 'SIMULATION'] = 'SIMULATION'


class LocalResult(BaseModel):
    event: VisionEvent
    status: Literal['LOCAL_VALIDATED'] = 'LOCAL_VALIDATED'
    delivery: Literal['NOT_SENT', 'HTTP_ACKNOWLEDGED', 'FAILED', 'UNCERTAIN'] = 'NOT_SENT'
    java_integration: Literal['UNAVAILABLE', 'CONFIGURED_UNVERIFIED'] = 'UNAVAILABLE'
    transport_result: DeliveryResult | None = None


class History(BaseModel):
    total: int
    items: list[LocalResult]


def simulator_router(mapping: CameraMap, delivery_settings: DeliverySettings | None = None) -> APIRouter:
    registry = EventRegistry(mapping)
    client = JavaClient(delivery_settings or DeliverySettings())
    ledger = DeliveryLedger(client)
    router = APIRouter(prefix='/api/v1/vision', tags=['Local simulator'])

    def envelope(event):
        result = ledger.result(event.event_id)
        return LocalResult(event=event, delivery=result.state if result else 'NOT_SENT',
                           java_integration='CONFIGURED_UNVERIFIED' if client.enabled else 'UNAVAILABLE',
                           transport_result=result)

    @router.get('/cameras')
    def cameras():
        return dict(mode='LOCAL_SIMULATOR', cameras=mapping.cameras,
                    sectors=sorted(mapping.sectors), hardware_connected=False)

    @router.post('/events/simulate', response_model=LocalResult)
    def simulate(request: SimulationRequest):
        observation = Observation.model_validate(request.model_dump(exclude={'operation_id'}))
        try:
            event = registry.create(request.operation_id, observation)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from None
        return envelope(event)

    @router.get('/events', response_model=History)
    def history(offset: int = Query(default=0, ge=0), limit: int = Query(default=50, ge=1, le=100)):
        total, events = registry.history(offset, limit)
        return History(total=total, items=[envelope(event) for event in events])

    @router.get('/events/{event_id}', response_model=LocalResult)
    def result(event_id: UUID):
        event = registry.get(event_id)
        if event is None:
            raise HTTPException(404, 'Evento local nao encontrado.')
        return envelope(event)

    @router.post('/events/{event_id}/send', response_model=LocalResult)
    def send(event_id: UUID):
        event = registry.get(event_id)
        if event is None:
            raise HTTPException(404, 'Evento local nao encontrado.')
        ledger.send(registry.retry(event))
        return envelope(event)

    return router
