from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def client():
    with TestClient(create_app(Settings(_env_file=None))) as client:
        yield client


def entry(**changes):
    return dict(operation_id='entry-1', camera_id='CAM_ENTRADA', event_type='ENTRY',
                plate='ABC1D23', source='SIMULATION') | changes


def test_functional_flow(client):
    cameras = client.get('/api/v1/vision/cameras').json()
    assert {c['camera_id'] for c in cameras['cameras']} == {'CAM_ENTRADA', 'CAM_A_B', 'CAM_SAIDA'}
    payloads = [entry(), entry(operation_id='ab-1', camera_id='CAM_A_B', event_type='PASSAGE', origin_sector='A', destination_sector='B'),
                entry(operation_id='exit-1', camera_id='CAM_SAIDA', event_type='EXIT')]
    for payload in payloads:
        response = client.post('/api/v1/vision/events/simulate', json=payload)
        assert response.status_code == 200
        result = response.json()
        assert result['status'] == 'LOCAL_VALIDATED'
        assert result['delivery'] == 'NOT_SENT'
        assert result['java_integration'] == 'UNAVAILABLE'
        assert result['event']['confidence'] is None
        assert result['event']['source'] == 'SIMULATION'
        assert client.post('/api/v1/vision/events/simulate', json=payload).json() == result
        assert client.get('/api/v1/vision/events/' + result['event']['event_id']).json() == result
    assert client.get('/api/v1/vision/events').json()['total'] == 3
    assert len(client.get('/api/v1/vision/events?offset=1&limit=1').json()['items']) == 1
    assert client.get('/api/v1/vision/events?offset=20').json()['items'] == []
    assert client.get('/health').status_code == 200


def test_no_plate(client):
    response = client.post('/api/v1/vision/events/simulate', json=entry(plate=None, source='ASSISTED'))
    assert response.status_code == 200
    assert response.json()['event']['session_id'] is None
    passage = entry(operation_id='ab', plate=None, session_id='external-known-session', source='ASSISTED',
                    camera_id='CAM_A_B', event_type='PASSAGE', origin_sector='A', destination_sector='B')
    assert client.post('/api/v1/vision/events/simulate', json=passage).status_code == 200
    assert client.post('/api/v1/vision/events/simulate', json=entry(operation_id='exit', plate=None, session_id='external-known-session', camera_id='CAM_SAIDA', event_type='EXIT')).status_code == 200


@pytest.mark.parametrize('changes', [
    {'camera_id': 'UNKNOWN'}, {'source': 'OCR'}, {'source': 'SIMULATED'},
    {'confidence': .9}, {'plate': 'INVALID'},
    {'camera_id': 'CAM_A_B', 'event_type': 'PASSAGE', 'origin_sector': 'B', 'destination_sector': 'A'},
    {'camera_id': 'CAM_SAIDA', 'event_type': 'EXIT', 'plate': None},
])
def test_rejections(client, changes):
    assert client.post('/api/v1/vision/events/simulate', json=entry(**changes)).status_code == 422
    assert client.get('/api/v1/vision/events').json()['total'] == 0


def test_parallel_retry_conflict_and_later_passage(client):
    with ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(lambda _: client.post('/api/v1/vision/events/simulate', json=entry()).json(), range(10)))
    assert len({r['event']['event_id'] for r in results}) == 1
    assert client.post('/api/v1/vision/events/simulate', json=entry(plate='XYZ1234')).status_code == 422
    later = client.post('/api/v1/vision/events/simulate', json=entry(operation_id='entry-2')).json()
    assert later['event']['event_id'] != results[0]['event']['event_id']
    assert client.get('/api/v1/vision/events').json()['total'] == 2
    assert client.get('/api/v1/vision/events/00000000-0000-0000-0000-000000000000').status_code == 404


def test_custom_camera_map_and_invalid_config(tmp_path):
    path = tmp_path / 'cameras.json'
    path.write_text('{"cameras":[{"camera_id":"CUSTOM","event_type":"ENTRY"}]}', encoding='utf-8')
    settings = Settings(_env_file=None, camera_config=path)
    with TestClient(create_app(settings)) as client:
        assert client.post('/api/v1/vision/events/simulate', json=entry(camera_id='CUSTOM')).status_code == 200
        assert client.post('/api/v1/vision/events/simulate', json=entry()).status_code == 422
    path.write_text('secret-invalid-json', encoding='utf-8')
    with pytest.raises(RuntimeError, match='Invalid camera configuration') as error:
        create_app(settings)
    assert 'secret-invalid-json' not in str(error.value)


def test_history_is_instance_local(client):
    assert client.post('/api/v1/vision/events/simulate', json=entry()).status_code == 200
    with TestClient(create_app(Settings(_env_file=None))) as other:
        assert other.get('/api/v1/vision/events').json()['total'] == 0
