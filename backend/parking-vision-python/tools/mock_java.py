"""HTTP test double only; no Java, sessions, tickets or payments.

Run: python -m uvicorn tools.mock_java:app --host 127.0.0.1 --port 9001
"""
import asyncio
import os
import secrets
from threading import Lock

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse

app = FastAPI(title='MOCK HTTP — NOT Spring Boot')
lock = Lock()
seen = {}
calls = {}


@app.get('/mock/stats')
def stats():
    with lock:
        return dict(mock=True, unique_events=len(seen), calls=dict(calls))


@app.post('/mock/{scenario}')
async def receive(scenario: str, payload: dict, x_internal_api_key: str = Header(default='')):
    if not secrets.compare_digest(x_internal_api_key, os.getenv('MOCK_API_KEY', 'local-mock-only')):
        raise HTTPException(401, 'Mock authentication failed')
    if scenario not in ('ok', '500-once', 'timeout-once', '401', '403', '422', '500'):
        raise HTTPException(404, 'Unknown mock scenario')
    event_id = payload.get('event_id')
    if not isinstance(event_id, str):
        raise HTTPException(422, 'Missing event_id')
    key = scenario + ':' + event_id
    with lock:
        calls[key] = calls.get(key, 0) + 1
        count = calls[key]
        if scenario in ('401', '403', '422', '500'):
            return JSONResponse(status_code=int(scenario), content={'mock': True})
        if key in seen and seen[key] != payload:
            raise HTTPException(409, 'Mock event_id payload conflict')
        seen[key] = payload
    if scenario == '500-once' and count == 1:
        return JSONResponse(status_code=500, content={'mock': True})
    if scenario == 'timeout-once' and count == 1:
        await asyncio.sleep(1)
    return {'mock': True, 'acknowledged_event_id': event_id}
