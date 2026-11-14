"""HTTP adapter for the PY-04 local registry, not a Java client."""
from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import AwareDatetime, BaseModel, Field

from app.events import CameraMap, EventRegistry, Identifier, Observation, VisionEvent


class SimulationRequest(Observation):
    operation_id: Identifier
    detected_at: AwareDatetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source: Literal['ASSISTED', 'SIMULATION'] = 'SIMULATION'


class LocalResult(BaseModel):
    event: VisionEvent
    status: Literal['LOCAL_VALIDATED'] = 'LOCAL_VALIDATED'
    delivery: Literal['NOT_SENT'] = 'NOT_SENT'
    java_integration: Literal['UNAVAILABLE'] = 'UNAVAILABLE'


class History(BaseModel):
    total: int
    items: list[LocalResult]


def simulator_router(mapping: CameraMap) -> APIRouter:
    registry = EventRegistry(mapping)
    router = APIRouter(prefix='/api/v1/vision', tags=['Local simulator'])

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
        return LocalResult(event=event)

    @router.get('/events', response_model=History)
    def history(offset: int = Query(default=0, ge=0), limit: int = Query(default=50, ge=1, le=100)):
        total, events = registry.history(offset, limit)
        return History(total=total, items=[LocalResult(event=event) for event in events])

    @router.get('/events/{event_id}', response_model=LocalResult)
    def result(event_id: UUID):
        event = registry.get(event_id)
        if event is None:
            raise HTTPException(404, 'Evento local nao encontrado.')
        return LocalResult(event=event)

    return router
