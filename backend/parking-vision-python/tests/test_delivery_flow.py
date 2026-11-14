"""FastAPI -> registry -> real client -> HTTP test transport (not Spring Boot)."""
import json
import logging

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, load_settings
from app.java_client import JavaClient
from app.main import create_app


@pytest.mark.parametrize('scenario,expected,attempts', [
    ('success', 'HTTP_ACKNOWLEDGED', 1), ('transient', 'HTTP_ACKNOWLEDGED', 2),
    ('timeout', 'UNCERTAIN', 3), ('offline', 'UNCERTAIN', 3),
    ('401', 'FAILED', 1), ('403', 'FAILED', 1), ('422', 'FAILED', 1), ('500', 'UNCERTAIN', 3),
])
def test_api_delivery_history_and_identity(monkeypatch, caplog, scenario, expected, attempts):
    requests = []

    def handler(request):
        requests.append(request)
        assert request.headers['X-Internal-API-Key'] == 'test-secret-only'
        if scenario == 'timeout':
            raise httpx.ReadTimeout('test-secret-only internal traceback', request=request)
        if scenario == 'offline':
            raise httpx.ConnectError('test-secret-only internal traceback', request=request)
        code = (500 if len(requests) == 1 else 200) if scenario == 'transient' else int(scenario) if scenario.isdigit() else 200
        return httpx.Response(code, json={'private_upstream_body': 'test-secret-only'})

    transport = httpx.MockTransport(handler)
    monkeypatch.setattr('app.simulator.JavaClient', lambda settings: JavaClient(settings, transport=transport))
    caplog.set_level(logging.INFO, logger='app.java_client')
    settings = Settings(_env_file=None, java_api_base_url='http://localhost:9001', java_events_endpoint='/mock/events',
                        internal_api_key='test-secret-only', java_idempotency_confirmed=True, java_retry_delay=0)
    with TestClient(create_app(settings)) as client:
        body = dict(operation_id='passage-1', camera_id='CAM_A_B', event_type='PASSAGE',
                    origin_sector='A', destination_sector='B', plate='ABC1D23', source='ASSISTED')
        local = client.post('/api/v1/vision/events/simulate', json=body).json()
        assert local['delivery'] == 'NOT_SENT' and not requests
        event = local['event']
        sent = client.post(f"/api/v1/vision/events/{event['event_id']}/send").json()
        assert sent['event'] == event
        assert sent['delivery'] == expected
        assert sent['status'] == 'LOCAL_VALIDATED'
        assert sent['java_integration'] == 'CONFIGURED_UNVERIFIED'
        assert sent['transport_result']['attempts'] == attempts
        assert len(requests) == attempts
        assert all(json.loads(request.content) == event for request in requests)
        assert client.get('/api/v1/vision/events').json()['items'] == [sent]
        assert client.post('/api/v1/vision/events/simulate', json=body).json() == sent
        if expected == 'HTTP_ACKNOWLEDGED':
            assert client.post(f"/api/v1/vision/events/{event['event_id']}/send").json() == sent
            assert len(requests) == attempts
        assert client.post('/api/v1/vision/events/simulate', json=body | {'plate': 'XYZ1234'}).status_code == 422
        assert len(requests) == attempts
        assert 'test-secret-only' not in json.dumps(sent) + caplog.text
        assert 'ABC1D23' not in caplog.text
        assert str(event['event_id']) in caplog.text


def test_no_idempotency_blocks_uncertain_manual_retry(monkeypatch):
    calls = []
    def handler(request):
        calls.append(request.content)
        raise httpx.ReadTimeout('fixture', request=request)
    monkeypatch.setattr('app.simulator.JavaClient', lambda settings: JavaClient(settings, transport=httpx.MockTransport(handler)))
    settings = Settings(_env_file=None, java_api_base_url='http://localhost:9001', java_events_endpoint='/mock/events')
    with TestClient(create_app(settings)) as client:
        body = dict(operation_id='manual-entry', camera_id='CAM_ENTRADA', event_type='ENTRY', source='ASSISTED')
        event = client.post('/api/v1/vision/events/simulate', json=body).json()['event']
        url = f"/api/v1/vision/events/{event['event_id']}/send"
        first = client.post(url).json()
        assert first['delivery'] == 'UNCERTAIN'
        assert first['event']['plate'] is None and first['event']['session_id'] is None
        assert client.post(url).json() == first
        assert len(calls) == 1


@pytest.mark.parametrize('name,value', [
    ('JAVA_API_BASE_URL', 'http://localhost:9001'),
    ('JAVA_EVENTS_ENDPOINT', '/mock/events'),
    ('JAVA_TIMEOUT', '-1'), ('JAVA_TIMEOUT', 'NaN'),
    ('JAVA_MAX_RETRIES', '4'), ('JAVA_RETRY_DELAY', '-1'),
    ('JAVA_IDEMPOTENCY_CONFIRMED', 'not-a-boolean'),
    ('INTERNAL_API_KEY', 'fixture-secret\ninvalid'),
])
def test_bad_environment_fails_without_values(monkeypatch, tmp_path, name, value):
    monkeypatch.setitem(Settings.model_config, 'env_file', tmp_path / 'absent.env')
    monkeypatch.setenv(name, value)
    with pytest.raises(RuntimeError) as error:
        load_settings()
    assert str(error.value) == 'Invalid configuration: check environment or .env (CORS_ORIGINS and delivery settings).'


def test_env_example_starts_offline():
    from pathlib import Path
    settings = Settings(_env_file=Path(__file__).resolve().parents[1] / '.env.example')
    assert settings.java_api_base_url is None
    assert settings.java_events_endpoint is None
    assert settings.internal_api_key is None
    with TestClient(create_app(settings)) as client:
        assert client.get('/health').status_code == 200
        event = client.post('/api/v1/vision/events/simulate', json=dict(
            operation_id='offline', camera_id='CAM_ENTRADA', event_type='ENTRY', source='ASSISTED')).json()['event']
        sent = client.post(f"/api/v1/vision/events/{event['event_id']}/send").json()
        assert sent['delivery'] == 'NOT_SENT'
        assert sent['transport_result']['attempts'] == 0
