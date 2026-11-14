"""JV-02 demonstration: unchanged Python producer/client -> real Spring Boot.
Run with parking-vision-python's venv after building the Java JAR.
Uses a temporary database and ephemeral internal key; no business effects claimed.
"""
from contextlib import contextmanager
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from uuid import uuid4

import httpx

ROOT = Path(__file__).resolve().parents[1]
VISION = ROOT.parent / "parking-vision-python"
sys.path.insert(0, str(VISION))
from app.events import CameraMap, EventRegistry, Observation
from app.java_client import DeliverySettings, JavaClient

ROUTE = "/api/v1/internal/vision-events"


@contextmanager
def java_server(java, jar, environment, log, origin):
    with log.open("wb") as output:
        process = subprocess.Popen(
            [str(java), "-jar", str(jar)], cwd=ROOT, env=environment,
            stdin=subprocess.DEVNULL, stdout=output, stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        try:
            deadline = time.monotonic() + 30
            with httpx.Client(trust_env=False, timeout=.5) as client:
                while time.monotonic() < deadline:
                    if process.poll() is not None:
                        raise RuntimeError("Java startup failed; check JDK 21 and rebuild the JAR.")
                    try:
                        if client.get(origin + "/health").status_code == 200:
                            break
                    except httpx.RequestError:
                        pass
                    time.sleep(.15)
                else:
                    raise RuntimeError("Java health did not become available.")
            yield
        finally:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)


def main():
    jar = ROOT / "target/parking-core-java-0.1.0-SNAPSHOT.jar"
    if not jar.is_file():
        raise RuntimeError("Build Java first: mvnw clean verify.")
    java_home = os.environ.get("JAVA_HOME")
    java = Path(java_home) / "bin" / ("java.exe" if os.name == "nt" else "java") if java_home else shutil.which("java")
    if not java:
        raise RuntimeError("Set JAVA_HOME to JDK 21.")
    with socket.socket() as address:
        address.bind(("127.0.0.1", 0))
        port = address.getsockname()[1]
    origin = f"http://127.0.0.1:{port}"
    key = secrets.token_urlsafe(32)
    sender = JavaClient(DeliverySettings(
        java_api_base_url=origin, java_events_endpoint=ROUTE, internal_api_key=key,
        java_timeout=2, java_max_retries=2, java_retry_delay=.05, java_idempotency_confirmed=True,
    ))
    mapping = CameraMap.model_validate_json((VISION / "cameras.example.json").read_text(encoding="utf-8"))
    registry = EventRegistry(mapping)
    tools = ROOT / ".tools"
    tools.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="jv02-demo-", dir=tools) as temporary:
        workspace = Path(temporary)
        environment = dict(os.environ, CORE_PORT=str(port), CORE_BIND_ADDRESS="127.0.0.1",
                           CORE_DB_PATH=str(workspace / "events.db"), INTERNAL_API_KEY=key)
        receipts = {}
        events = []
        with httpx.Client(base_url=origin, headers={"X-Internal-API-Key": key}, trust_env=False, timeout=3) as client:
            with java_server(java, jar, environment, workspace / "first.log", origin):
                for camera in mapping.cameras:
                    observation = Observation(
                        **camera.model_dump(), plate="ABC1D23", detected_at=datetime.now(timezone.utc),
                        source="SIMULATION",
                    )
                    event = registry.create(f"demo-{camera.camera_id}", observation)
                    result = sender.send(event)
                    assert result.state == "HTTP_ACKNOWLEDGED" and result.http_status == 200
                    lookup = client.get(f"{ROUTE}/{event.event_id}")
                    assert lookup.status_code == 200
                    stored = lookup.json()
                    assert stored["event"]["event_id"] == str(event.event_id)
                    assert stored["event"]["event_type"] == event.event_type
                    assert stored["receipt"]["status"] == "RECORDED"
                    receipts[event.event_id] = stored["receipt"]
                    retry = client.post(ROUTE, content=registry.retry(event).model_dump_json(),
                                        headers={"Content-Type": "application/json"})
                    assert retry.status_code == 200 and retry.json() == stored["receipt"]
                    assert registry.create(f"demo-{camera.camera_id}", observation).event_id == event.event_id
                    events.append(event)
                    print(f"{event.event_type}: Python client -> Java HTTP 200, lookup/replay verified")

                manual = registry.create("demo-no-plate", Observation(
                    camera_id="CAM_ENTRADA", event_type="ENTRY", source="ASSISTED",
                    detected_at=datetime.now(timezone.utc),
                ))
                assert sender.send(manual).state == "HTTP_ACKNOWLEDGED"
                assert client.get(f"{ROUTE}/{manual.event_id}").json()["event"]["plate"] is None
                print("ASSISTED entry without plate: recorded, no session/ticket fabricated")

                first = events[0]
                conflict = json.loads(first.model_dump_json())
                conflict["plate"] = "XYZ9876"
                assert client.post(ROUTE, json=conflict).status_code == 409
                invalid = dict(conflict, event_id=str(uuid4()), event_type="PASSAGE",
                               origin_sector="A", destination_sector="A")
                assert client.post(ROUTE, json=invalid).status_code == 422
                assert client.get(f"{ROUTE}/{invalid['event_id']}").status_code == 404
                with httpx.Client(base_url=origin, trust_env=False, timeout=3) as unauthorized:
                    assert unauthorized.post(ROUTE, json=conflict).status_code == 401
                    assert unauthorized.post(ROUTE, json=conflict,
                                             headers={"X-Internal-API-Key": "wrong"}).status_code == 401
                print("Conflicting event_id=409; invalid passage=422; absent/wrong authentication=401")

            failed = sender.send(events[0])
            # Windows may time out while another OS immediately refuses the connection.
            assert failed.state == "UNCERTAIN" and failed.error in {"network_error", "timeout"} and failed.attempts == 3
            print(f"Java stopped: Python reports UNCERTAIN/{failed.error} after 3 bounded attempts")

            with java_server(java, jar, environment, workspace / "restart.log", origin):
                for event in events:
                    assert sender.send(event).state == "HTTP_ACKNOWLEDGED"
                    stored = client.get(f"{ROUTE}/{event.event_id}").json()
                    assert stored["receipt"] == receipts[event.event_id]
                print("Java restarted: original receipts/event_ids preserved and retries accepted")

        for log in workspace.glob("*.log"):
            text = log.read_text(encoding="utf-8", errors="replace")
            assert key not in text and "ABC1D23" not in text and "XYZ9876" not in text
        print("PASS: real event ingestion only; no sessions, occupancy, payment or OCR validation")


if __name__ == "__main__":
    main()
