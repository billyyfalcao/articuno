from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.events import Camera, CameraMap, EventRegistry, Observation, VisionEvent


def registry():
    return EventRegistry(CameraMap(sectors=frozenset({'A', 'B'}), cameras=(
        Camera(camera_id='IN', event_type='ENTRY'),
        Camera(camera_id='AB', event_type='PASSAGE', origin_sector='A', destination_sector='B'),
        Camera(camera_id='OUT', event_type='EXIT'),
    )))


def observation(**changes):
    return Observation(**(dict(camera_id='IN', event_type='ENTRY', source='ASSISTED',
                               detected_at=datetime.now(timezone.utc), plate=None) | changes))


def test_valid_events_and_serialization():
    service = registry()
    for camera, kind, sectors in [('IN', 'ENTRY', {}), ('AB', 'PASSAGE', dict(origin_sector='A', destination_sector='B')), ('OUT', 'EXIT', {})]:
        event = service.create(camera, observation(camera_id=camera, event_type=kind, session_id='known-session', **sectors))
        assert event.event_type == kind
        assert event.plate is None
        assert event.confidence is None
        assert event.model_dump(mode='json')['detected_at'].endswith('Z')
        assert service.retry(event) is event


def test_deduplication_retry_and_later_passage():
    service = registry()
    first = service.create('passage-1', observation(plate='ABC1234'))
    repeated = service.create('passage-1', observation(plate='ABC1234'))
    assert repeated is first
    assert service.retry(first).event_id == first.event_id
    assert service.retry(VisionEvent.model_validate_json(first.model_dump_json())) == first
    later = service.create('passage-2', observation(plate='ABC1234'))
    assert later.event_id != first.event_id
    with pytest.raises(ValueError, match='operation'):
        service.create('passage-1', observation(plate='XYZ1234'))
    changed = first.model_copy(update={'plate': 'XYZ1234'})
    with pytest.raises(ValueError, match='event_id'):
        service.retry(changed)


def test_concurrent_repeats():
    service = registry()
    with ThreadPoolExecutor(max_workers=8) as executor:
        events = list(executor.map(lambda _: service.create('same', observation()), range(30)))
    assert len({e.event_id for e in events}) == 1


@pytest.mark.parametrize('changes', [
    {'camera_id': 'UNKNOWN'}, {'camera_id': 'AB'},
    {'camera_id': 'AB', 'event_type': 'PASSAGE', 'origin_sector': 'B', 'destination_sector': 'A'},
])
def test_invalid_mapping(changes):
    candidate = observation(session_id='known-session', **changes)
    with pytest.raises(ValueError):
        registry().create('invalid', candidate)


@pytest.mark.parametrize('changes', [
    {'detected_at': datetime(2026, 1, 1)}, {'plate': 'BAD'},
    {'confidence': .9}, {'source': 'OCR', 'plate': 'ABC1234', 'confidence': 1.1},
    {'source': 'OCR', 'plate': 'ABC1234', 'confidence': -.1},
    {'source': 'OCR', 'plate': None, 'confidence': .9},
    {'source': 'OCR', 'plate': 'ABC1234', 'confidence': None},
    {'event_type': 'PASSAGE'}, {'origin_sector': 'A'},
])
def test_invalid_observations(changes):
    with pytest.raises(ValidationError):
        observation(**changes)


def test_ocr_gate():
    service = registry()
    for confidence, confirmed in [(.2, True), (.9, False)]:
        with pytest.raises(ValueError, match='OCR'):
            service.create('ocr', observation(source='OCR', plate='ABC1D23', confidence=confidence), confirmed=confirmed)
    event = service.create('ocr', observation(source='OCR', plate='ABC1D23', confidence=.9), confirmed=True)
    assert event.source == 'OCR'


def test_camera_config_and_capacity():
    with pytest.raises(ValidationError):
        CameraMap(sectors=frozenset({'A'}), cameras=(Camera(camera_id='AB', event_type='PASSAGE', origin_sector='A', destination_sector='B'),))
    camera = Camera(camera_id='IN', event_type='ENTRY')
    with pytest.raises(ValidationError):
        CameraMap(cameras=(camera, camera))
    service = EventRegistry(CameraMap(cameras=(camera,)), capacity=1)
    event = service.create('one', observation())
    assert service.create('one', observation()) is event
    with pytest.raises(ValueError, match='capacity'):
        service.create('two', observation())


@pytest.mark.parametrize('source', ['ASSISTED', 'SIMULATION'])
def test_unidentified_entry_and_session_passage(source):
    service = registry()
    assert service.create('entry', observation(source=source)).plate is None
    event = service.create('passage', observation(
        camera_id='AB', event_type='PASSAGE', origin_sector='A', destination_sector='B',
        session_id='session-123', source=source))
    assert event.session_id == 'session-123'
    with pytest.raises(ValidationError):
        observation(camera_id='OUT', event_type='EXIT', source=source)


def test_reject_unknown_retry_and_preserve_first_observation():
    service = registry()
    first = service.create('ocr', observation(source='OCR', plate='ABC1234', confidence=.85), confirmed=True)
    assert service.create('ocr', observation(source='OCR', plate='ABC1234', confidence=.99), confirmed=True) == first
    assert first.confidence == .85
    with pytest.raises(ValueError, match='event_id'):
        registry().retry(first)


def test_later_passage_with_interleaved_retries():
    service = registry()
    candidate = observation(camera_id='AB', event_type='PASSAGE',
                            origin_sector='A', destination_sector='B', plate='ABC1D23')
    first = service.create('physical-passage-1', candidate)
    second = service.create('physical-passage-2', candidate)
    assert first.event_id != second.event_id
    assert service.create('physical-passage-1', candidate) is first
    assert service.create('physical-passage-2', candidate) is second
    assert service.retry(VisionEvent.model_validate_json(first.model_dump_json())) == first
