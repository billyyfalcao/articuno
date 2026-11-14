"""Local event preparation only. Java wire contract remains unconfirmed."""
from enum import StrEnum
from threading import Lock
from typing import Annotated
from uuid import UUID, uuid4

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator


Identifier = Annotated[str, Field(min_length=1, max_length=128, pattern=r'^\S+$')]


class EventType(StrEnum):
    ENTRY = 'ENTRY'
    PASSAGE = 'PASSAGE'
    EXIT = 'EXIT'


class Source(StrEnum):
    OCR = 'OCR'
    ASSISTED = 'ASSISTED'
    SIMULATION = 'SIMULATION'


class Camera(BaseModel):
    model_config = ConfigDict(frozen=True, extra='forbid')
    camera_id: Identifier
    event_type: EventType
    origin_sector: Identifier | None = None
    destination_sector: Identifier | None = None

    @model_validator(mode='after')
    def route(self):
        if self.event_type == EventType.PASSAGE:
            if not self.origin_sector or not self.destination_sector or self.origin_sector == self.destination_sector:
                raise ValueError('PASSAGE requires two different sectors')
        elif self.origin_sector is not None or self.destination_sector is not None:
            raise ValueError('Sector transitions are only supported for PASSAGE')
        return self


class CameraMap(BaseModel):
    model_config = ConfigDict(frozen=True, extra='forbid')
    sectors: frozenset[Identifier] = frozenset()
    cameras: tuple[Camera, ...]

    @model_validator(mode='after')
    def mapping(self):
        if len({c.camera_id for c in self.cameras}) != len(self.cameras):
            raise ValueError('Duplicate camera_id')
        for camera in self.cameras:
            if camera.event_type == EventType.PASSAGE and not {camera.origin_sector, camera.destination_sector} <= self.sectors:
                raise ValueError('Unknown sector in camera route')
        return self


class Observation(Camera):
    plate: str | None = Field(default=None, pattern=r'^[A-Z]{3}(?:[0-9]{4}|[0-9][A-Z][0-9]{2})$')
    session_id: Identifier | None = None
    detected_at: AwareDatetime
    confidence: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    source: Source

    @model_validator(mode='after')
    def evidence(self):
        if self.source == Source.OCR:
            if self.plate is None or self.confidence is None:
                raise ValueError('OCR requires a validated plate and confidence')
        elif self.confidence is not None:
            raise ValueError('Manual/simulation events must not invent confidence')
        if self.plate is None and self.session_id is None and self.event_type != EventType.ENTRY:
            raise ValueError('PASSAGE/EXIT without a plate require a known session_id')
        return self


class VisionEvent(Observation):
    event_id: UUID = Field(default_factory=uuid4)


class EventRegistry:
    """Thread-safe in-memory operation ledger. No implicit expiry or delivery."""

    def __init__(self, mapping: CameraMap, *, capacity: int = 1000, minimum_confidence: float = .8):
        if capacity < 1 or not 0 <= minimum_confidence <= 1:
            raise ValueError('Invalid registry configuration')
        self.cameras = {camera.camera_id: camera for camera in mapping.cameras}
        self.capacity = capacity
        self.minimum_confidence = minimum_confidence
        self._operations: dict[str, VisionEvent] = {}
        self._events: dict[UUID, VisionEvent] = {}
        self._lock = Lock()

    def create(self, operation_id: str, observation: Observation, *, confirmed: bool = False) -> VisionEvent:
        if not isinstance(operation_id, str) or not operation_id.strip() or len(operation_id) > 128:
            raise ValueError('Invalid operation_id')
        # Validate again at the boundary, including objects made with model_copy.
        observation = Observation.model_validate(observation.model_dump())
        camera = self.cameras.get(observation.camera_id)
        if camera is None or any(getattr(observation, key) != getattr(camera, key) for key in ('event_type', 'origin_sector', 'destination_sector')):
            raise ValueError('Unknown camera or impossible transition')
        if observation.source == Source.OCR and (not confirmed or observation.confidence < self.minimum_confidence):
            raise ValueError('OCR requires confirmation and sufficient confidence')
        with self._lock:
            if operation_id in self._operations:
                existing = self._operations[operation_id]
                # Subsequent frames may have a different timestamp/score, never a new event.
                identity = ('camera_id', 'event_type', 'origin_sector', 'destination_sector', 'plate', 'session_id', 'source')
                if any(getattr(existing, key) != getattr(observation, key) for key in identity):
                    raise ValueError('Conflicting operation_id; use a new id for a distinct passage')
                return existing
            if len(self._operations) >= self.capacity:
                raise ValueError('Registry capacity reached; existing retries remain available')
            event = VisionEvent(**observation.model_dump())
            self._operations[operation_id] = event
            self._events[event.event_id] = event
            return event

    def retry(self, event: VisionEvent) -> VisionEvent:
        with self._lock:
            existing = self._events.get(event.event_id)
            if existing is None or existing != event:
                raise ValueError('Unknown or conflicting event_id')
            return existing
