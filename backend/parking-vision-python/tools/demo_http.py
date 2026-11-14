"""Two-process local HTTP smoke; creates no external requests or business data."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.request
import urllib.error


ROOT = Path(__file__).resolve().parents[1]


def create_demo_app():
    """Use only the child process environment, never the operator's .env file."""
    from app.config import Settings
    from app.main import create_app
    return create_app(Settings(_env_file=None))


def request(port, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f'http://127.0.0.1:{port}{path}', data=data,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=10) as response:
        return json.load(response)


def start(module, port, env, health, factory=False):
    command = [sys.executable, '-m', 'uvicorn', module, '--host', '127.0.0.1', '--port', str(port), '--no-access-log']
    if factory:
        command.append('--factory')
    process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(100):
        if process.poll() is not None:
            raise RuntimeError('Local service failed to start (check ports 19001/19002)')
        try:
            request(port, health)
            return process
        except OSError:
            time.sleep(.05)
    process.terminate()
    process.wait(timeout=5)
    raise RuntimeError('Local service startup timed out')


def main():
    env = dict(os.environ, MOCK_API_KEY='local-mock-only')
    mock = start('tools.mock_java:app', 19001, env, '/mock/stats')
    try:
        for scenario in ('ok', '500-once', 'timeout-once', '401', '403', '422', '500'):
            configured = dict(env, JAVA_API_BASE_URL='http://127.0.0.1:19001',
                              JAVA_EVENTS_ENDPOINT='/mock/' + scenario, INTERNAL_API_KEY='local-mock-only',
                              JAVA_IDEMPOTENCY_CONFIRMED='true', JAVA_TIMEOUT='.3', JAVA_RETRY_DELAY='0',
                              JAVA_MAX_RETRIES='2', CAMERA_CONFIG=str(ROOT / 'cameras.example.json'),
                              CORS_ORIGINS='[]', VIDEO_ROOT=str(ROOT / 'videos'))
            api = start('tools.demo_http:create_demo_app', 19002, configured, '/health', factory=True)
            try:
                for camera, kind, route in [('CAM_ENTRADA', 'ENTRY', {}), ('CAM_A_B', 'PASSAGE', dict(origin_sector='A', destination_sector='B')), ('CAM_SAIDA', 'EXIT', {})]:
                    body = dict(operation_id=kind, camera_id=camera, event_type=kind, plate='ABC1D23', source='SIMULATION', **route)
                    event = request(19002, '/api/v1/vision/events/simulate', body)['event']
                    result = request(19002, f"/api/v1/vision/events/{event['event_id']}/send", {})
                    expected = 'HTTP_ACKNOWLEDGED' if scenario in ('ok', '500-once', 'timeout-once') else 'UNCERTAIN' if scenario == '500' else 'FAILED'
                    assert result['delivery'] == expected, result
                    assert result['event'] == event
                    assert result['java_integration'] == 'CONFIGURED_UNVERIFIED'
                    count = request(19001, '/mock/stats')['calls'][scenario + ':' + event['event_id']]
                    assert count == (2 if scenario.endswith('-once') else 3 if scenario == '500' else 1)
                    if expected == 'HTTP_ACKNOWLEDGED':
                        assert request(19002, f"/api/v1/vision/events/{event['event_id']}/send", {}) == result
                        assert request(19001, '/mock/stats')['calls'][scenario + ':' + event['event_id']] == count
                if scenario == 'ok':
                    invalid = dict(operation_id='invalid', camera_id='CAM_A_B', event_type='PASSAGE',
                                   origin_sector='B', destination_sector='A', plate='ABC1D23', source='SIMULATION')
                    try:
                        request(19002, '/api/v1/vision/events/simulate', invalid)
                    except urllib.error.HTTPError as error:
                        assert error.code == 422
                    else:
                        raise AssertionError('Invalid route was accepted')
                    manual = dict(operation_id='no-plate', camera_id='CAM_ENTRADA', event_type='ENTRY', source='ASSISTED')
                    event = request(19002, '/api/v1/vision/events/simulate', manual)['event']
                    assert event['plate'] is None and event['session_id'] is None
                    assert request(19002, '/api/v1/vision/events/simulate', manual)['event'] == event
                    assert request(19002, f"/api/v1/vision/events/{event['event_id']}/send", {})['delivery'] == 'HTTP_ACKNOWLEDGED'
                    # A new physical passage remains possible after the original retry.
                    later = dict(operation_id='later-passage', camera_id='CAM_A_B', event_type='PASSAGE',
                                 origin_sector='A', destination_sector='B', plate='ABC1D23', source='SIMULATION')
                    later_event = request(19002, '/api/v1/vision/events/simulate', later)['event']
                    assert request(19002, f"/api/v1/vision/events/{later_event['event_id']}/send", {})['delivery'] == 'HTTP_ACKNOWLEDGED'
                    assert request(19002, '/api/v1/vision/events')['total'] == 5
                    assert request(19001, '/mock/stats')['unique_events'] == 5
                    print('No-plate ENTRY, invalid route 422, deduplication and later PASSAGE verified', flush=True)
                print(scenario, 'ENTRY/PASSAGE/EXIT verified; IDs preserved', flush=True)
            finally:
                api.terminate()
                api.wait(timeout=5)
        print('Two-process mock HTTP demo passed. NOT a Spring Boot integration.', flush=True)
    finally:
        mock.terminate()
        mock.wait(timeout=5)


if __name__ == '__main__':
    main()
