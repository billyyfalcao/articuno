import time
from threading import Event

import cv2
import numpy as np
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def wait_done(client):
    for _ in range(200):
        state = client.get('/api/v1/vision/status').json()
        if state['state'] not in ('running', 'stopping'):
            return state
        time.sleep(.01)
    raise AssertionError('processing did not finish')


def test_real_mp4(tmp_path):
    path = tmp_path / 'sample.mp4'
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*'mp4v'), 10, (64, 48))
    assert writer.isOpened()
    for _ in range(12):
        writer.write(np.zeros((48, 64, 3), dtype=np.uint8))
    writer.release()
    with TestClient(create_app(Settings(_env_file=None, video_root=tmp_path))) as client:
        assert client.post('/api/v1/vision/analyze/start', json={'filename': 'sample.mp4', 'sample_every': 3}).status_code == 202
        state = wait_done(client)
        assert state['state'] == 'completed'
        assert state['frames_read'] == 12
        assert state['frames_sampled'] == 4
        assert client.post('/api/v1/vision/analyze/stop').status_code == 200
        assert client.post('/api/v1/vision/analyze/start', json={'filename': 'sample.mp4'}).status_code == 202
        assert wait_done(client)['state'] == 'completed'


def test_invalid_sources(tmp_path):
    (tmp_path / 'broken.mp4').write_bytes(b'not a video')
    with TestClient(create_app(Settings(_env_file=None, video_root=tmp_path))) as client:
        for filename, status in [('missing.mp4', 404), ('../private.mp4', 422), ('https://example.com/a.mp4', 422), ('a.avi', 422), ('bad\x00.mp4', 422)]:
            assert client.post('/api/v1/vision/analyze/start', json={'filename': filename}).status_code == status
        assert client.post('/api/v1/vision/analyze/start', json={'filename': 'broken.mp4', 'sample_every': 0}).status_code == 422
        assert client.post('/api/v1/vision/analyze/start', json={'filename': 'broken.mp4'}).status_code == 202
        state = wait_done(client)
        assert state['state'] == 'error'
        assert state['error']


def test_stop_single_job_and_health(tmp_path, monkeypatch):
    entered, resume, released = Event(), Event(), Event()

    class Capture:
        def __init__(self, *args): pass
        def isOpened(self): return True
        def get(self, prop): return 0
        def read(self):
            entered.set()
            assert resume.wait(5)
            return True, np.zeros((2, 2, 3), dtype=np.uint8)
        def release(self): released.set()

    monkeypatch.setattr('app.video.cv2.VideoCapture', Capture)
    (tmp_path / 'sample.mp4').touch()
    with TestClient(create_app(Settings(_env_file=None, video_root=tmp_path))) as client:
        try:
            assert client.post('/api/v1/vision/analyze/start', json={'filename': 'sample.mp4'}).status_code == 202
            assert entered.wait(2)
            assert client.get('/health').status_code == 200
            assert client.get('/api/v1/vision/status').json()['state'] == 'running'
            assert client.post('/api/v1/vision/analyze/start', json={'filename': 'sample.mp4'}).status_code == 409
            assert client.post('/api/v1/vision/analyze/stop').json()['state'] == 'stopping'
        finally:
            resume.set()
        assert wait_done(client)['state'] == 'stopped'
        assert released.is_set()
