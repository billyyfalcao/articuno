from datetime import datetime, timezone

import httpx
import pytest

from app.events import VisionEvent
from app.java_client import DeliverySettings, JavaClient, DeliveryLedger


def event():
    return VisionEvent(camera_id='IN', event_type='ENTRY', source='SIMULATION',
                       plate='ABC1234', detected_at=datetime.now(timezone.utc))


def settings(**changes):
    return DeliverySettings(_env_file=None, java_api_base_url='http://localhost:9000',
                            java_events_endpoint='/mock/events', internal_api_key='test-only', **changes)


@pytest.mark.parametrize('code', [200, 201, 202, 204, 401, 403, 422, 500])
def test_http_status_and_secret_redaction(code, caplog):
    seen = []
    def handler(request):
        seen.append(request)
        return httpx.Response(code, text='test-only private response')
    result = JavaClient(settings(), transport=httpx.MockTransport(handler)).send(event())
    assert result.http_status == code
    assert result.state == ('HTTP_ACKNOWLEDGED' if code < 300 else 'UNCERTAIN' if code == 500 else 'FAILED')
    assert len(seen) == 1
    assert seen[0].headers['X-Internal-API-Key'] == 'test-only'
    assert 'test-only' not in result.model_dump_json() + caplog.text
    assert 'private response' not in result.model_dump_json() + caplog.text


@pytest.mark.parametrize('idempotent,expected', [(False, 1), (True, 3)])
def test_retry_stable_payload(idempotent, expected):
    requests = []
    def handler(request):
        requests.append(request.content)
        raise httpx.ReadTimeout('private token in exception', request=request)
    result = JavaClient(settings(java_idempotency_confirmed=idempotent, java_max_retries=2, java_retry_delay=0),
                        transport=httpx.MockTransport(handler)).send(event())
    assert result.state == 'UNCERTAIN'
    assert result.error == 'timeout'
    assert result.attempts == expected
    assert len(requests) == expected
    assert len(set(requests)) == 1


def test_500_then_success():
    calls = []
    def handler(request):
        calls.append(request.content)
        return httpx.Response(500 if len(calls) == 1 else 200, json={'mock': True})
    result = JavaClient(settings(java_idempotency_confirmed=True, java_retry_delay=0),
                        transport=httpx.MockTransport(handler)).send(event())
    assert result.state == 'HTTP_ACKNOWLEDGED'
    assert result.attempts == 2
    assert calls[0] == calls[1]


@pytest.mark.parametrize('endpoint', ['https://evil.example/path', '//evil.example/path', '/events?key=secret', '/events#fragment'])
def test_reject_unsafe_endpoint(endpoint):
    with pytest.raises(ValueError):
        DeliverySettings(_env_file=None, java_api_base_url='http://localhost:9000', java_events_endpoint=endpoint)


def test_disabled():
    assert JavaClient(DeliverySettings(_env_file=None)).send(event()).state == 'NOT_SENT'


@pytest.mark.parametrize('code', [301, 401, 403, 422])
def test_no_retry_or_redirect_for_rejections(code):
    calls = []
    def handler(request):
        calls.append(request)
        return httpx.Response(code, headers={'Location': 'http://other.example'})
    result = JavaClient(settings(java_idempotency_confirmed=True), transport=httpx.MockTransport(handler)).send(event())
    assert len(calls) == 1
    assert result.state == 'FAILED'


def test_guard_blocks_unsafe_resend_after_timeout():
    calls = []
    def handler(request):
        calls.append(request)
        raise httpx.ReadTimeout('private', request=request)
    ledger = DeliveryLedger(JavaClient(settings(), transport=httpx.MockTransport(handler)))
    item = event()
    first = ledger.send(item)
    assert first.state == 'UNCERTAIN'
    assert ledger.send(item) == first
    assert len(calls) == 1


def test_network_failure_and_payload():
    def handler(request):
        assert request.url.path == '/mock/events'
        assert b'ABC1234' in request.content
        raise httpx.ConnectError('private failure', request=request)
    assert JavaClient(settings(), transport=httpx.MockTransport(handler)).send(event()).error == 'network_error'


@pytest.mark.parametrize('key', ['test-é', 'test\nkey', 'test\x00key'])
def test_invalid_header_secret_is_sanitized(key):
    with pytest.raises(ValueError) as error:
        DeliverySettings(_env_file=None, internal_api_key=key)
    assert key not in str(error.value)


def test_concurrent_acknowledged_event_sent_once():
    from concurrent.futures import ThreadPoolExecutor
    calls = []
    def handler(request):
        calls.append(request.content)
        return httpx.Response(200)
    ledger = DeliveryLedger(JavaClient(settings(), transport=httpx.MockTransport(handler)))
    item = event()
    with ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(lambda _: ledger.send(item), range(10)))
    assert all(r.state == 'HTTP_ACKNOWLEDGED' for r in results)
    assert len(calls) == 1


@pytest.mark.parametrize('target', ['java_api_base_url', 'java_events_endpoint'])
@pytest.mark.parametrize('control', ['\x00', '\x1b', '\x7f'])
def test_invalid_transport_url_rejected_at_startup(target, control):
    values = dict(java_api_base_url='http://localhost', java_events_endpoint='/events')
    values[target] += control
    with pytest.raises(ValueError):
        DeliverySettings(_env_file=None, **values)
