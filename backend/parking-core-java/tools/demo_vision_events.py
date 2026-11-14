"""JV-03: real FastAPI HTTP -> Spring Boot, using temporary local data only."""
from contextlib import contextmanager
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
API = "/api/v1/internal"
ROUTE = API + "/vision-events"


def free_port():
    with socket.socket() as address:
        address.bind(("127.0.0.1", 0))
        return address.getsockname()[1]


@contextmanager
def service(command, cwd, environment, log, origin):
    with log.open("wb") as output:
        process = subprocess.Popen(
            command, cwd=cwd, env=environment, stdin=subprocess.DEVNULL,
            stdout=output, stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        try:
            deadline = time.monotonic() + 40
            with httpx.Client(trust_env=False, timeout=.5) as client:
                while time.monotonic() < deadline:
                    if process.poll() is not None:
                        raise RuntimeError("Service startup failed; check JDK 21, JAR and Python venv.")
                    try:
                        if client.get(origin + "/health").status_code == 200:
                            break
                    except httpx.RequestError:
                        pass
                    time.sleep(.15)
                else:
                    raise RuntimeError("Service health did not become available.")
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
    if not __debug__:
        raise RuntimeError("Run without Python -O: assertions verify the demonstration.")
    jar = ROOT / "target/parking-core-java-0.1.0-SNAPSHOT.jar"
    if not jar.is_file():
        raise RuntimeError("Build Java first: mvnw clean verify.")
    java_home = os.environ.get("JAVA_HOME")
    java = Path(java_home) / "bin" / ("java.exe" if os.name == "nt" else "java") if java_home else shutil.which("java")
    if not java:
        raise RuntimeError("Set JAVA_HOME to JDK 21.")
    java_port, python_port = free_port(), free_port()
    while python_port == java_port:
        python_port = free_port()
    java_origin = f"http://127.0.0.1:{java_port}"
    python_origin = f"http://127.0.0.1:{python_port}"
    key = secrets.token_urlsafe(32)
    tools = ROOT / ".tools"
    tools.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="jv03-demo-", dir=tools) as temporary:
        workspace = Path(temporary)
        layout = json.loads((ROOT / "parking.example.json").read_text(encoding="utf-8"))
        for sector in layout["sectors"]:
            sector["capacity"] = 2
        layout_path = workspace / "layout.json"
        layout_path.write_text(json.dumps(layout), encoding="utf-8")
        environment = dict(os.environ, CORE_PORT=str(java_port), CORE_BIND_ADDRESS="127.0.0.1",
                           CORE_DB_PATH=str(workspace / "sessions.db"), CORE_LAYOUT_PATH=str(layout_path),
                           INTERNAL_API_KEY=key, JAVA_API_BASE_URL=java_origin, JAVA_EVENTS_ENDPOINT=ROUTE,
                           JAVA_TIMEOUT="0.5", JAVA_MAX_RETRIES="2", JAVA_RETRY_DELAY="0.05",
                           JAVA_IDEMPOTENCY_CONFIRMED="true", CAMERA_CONFIG=str(VISION / "cameras.example.json"),
                           VIDEO_ROOT=str(VISION / "videos"), CORS_ORIGINS="[]")
        # Explicitly ignore the operator's .env; environment values above are isolated to children.
        bootstrap = ("import uvicorn; from app.main import create_app; from app.config import Settings; "
                     f"uvicorn.run(create_app(Settings(_env_file=None)), host='127.0.0.1', port={python_port}, log_level='warning')")
        java_command = [str(java), "-jar", str(jar)]
        receipts = {}
        with service([sys.executable, "-c", bootstrap], VISION, environment, workspace / "python.log", python_origin):
            with httpx.Client(base_url=python_origin, trust_env=False, timeout=15) as python, httpx.Client(
                    base_url=java_origin, headers={"X-Internal-API-Key": key}, trust_env=False, timeout=5) as core:
                cameras = {c["camera_id"]: c for c in python.get("/api/v1/vision/cameras").json()["cameras"]}

                def create(camera, plate=None, session_id=None):
                    request = dict(cameras[camera], operation_id=str(uuid4()), plate=plate,
                                   session_id=session_id, source="ASSISTED")
                    response = python.post("/api/v1/vision/events/simulate", json=request)
                    assert response.status_code == 200
                    event = response.json()["event"]
                    repeated = python.post("/api/v1/vision/events/simulate", json=request)
                    assert repeated.json()["event"]["event_id"] == event["event_id"]
                    return event

                def send(event, expected):
                    response = python.post(f"/api/v1/vision/events/{event['event_id']}/send")
                    assert response.status_code == 200
                    delivery = response.json()["transport_result"]
                    assert delivery["http_status"] == expected
                    assert delivery["state"] == ("HTTP_ACKNOWLEDGED" if expected == 200 else "FAILED")
                    return delivery

                def read(path):
                    response = core.get(API + path)
                    assert response.status_code == 200
                    return response.json()

                def verify_receipt(event, expected):
                    stored = read("/vision-events/" + event["event_id"])
                    assert stored["http_status"] == expected
                    assert stored["event"]["event_id"] == event["event_id"]
                    duplicate = core.post(ROUTE, json=event)
                    assert duplicate.status_code == expected and duplicate.json() == stored["receipt"]
                    receipts[event["event_id"]] = (event, stored["receipt"], expected)
                    return stored["receipt"]

                with service(java_command, ROOT, environment, workspace / "java-first.log", java_origin):
                    entry = create("CAM_ENTRADA", "ABC1D23")
                    send(entry, 200)
                    session_id = verify_receipt(entry, 200)["session_id"]
                    assert read("/sessions/" + session_id)["sector_id"] == "A"
                    assert read("/dashboard")["occupied_estimated"] == 1
                    print("ENTRY: real FastAPI -> Java 200; persistent session in A; estimated occupancy=1")

                    passage = create("CAM_A_B", "ABC1D23")
                    send(passage, 200)
                    assert verify_receipt(passage, 200)["session_id"] == session_id
                    assert read("/sessions/" + session_id)["sector_id"] == "B"
                    sectors = read("/sectors")["items"]
                    assert [s["occupied_estimated"] for s in sectors] == [0, 1]
                    print("PASSAGE A->B: same session; sector estimates A=0, B=1; replay has no extra effect")

                    exit_event = create("CAM_SAIDA", "ABC1D23")
                    send(exit_event, 403)
                    assert verify_receipt(exit_event, 403)["error"] == "exit_authorization_required"
                    assert read("/sessions/" + session_id)["status"] == "ACTIVE"
                    print("EXIT: Java 403, Python FAILED; session remains ACTIVE; no authorization fabricated")

                    manual = create("CAM_ENTRADA")
                    send(manual, 200)
                    manual_id = verify_receipt(manual, 200)["session_id"]
                    assert read("/sessions/" + manual_id)["plate"] is None
                    manual_passage = create("CAM_A_B", session_id=manual_id)
                    send(manual_passage, 200)
                    verify_receipt(manual_passage, 200)
                    assert read("/sessions/" + manual_id)["sector_id"] == "B"
                    print("ASSISTED without plate: real session_id returned, passage tracked without invented plate")

                    impossible = create("CAM_A_B", "ABC1D23")
                    send(impossible, 409)
                    assert verify_receipt(impossible, 409)["error"] == "invalid_session_transition"
                    conflict = dict(entry, plate="XYZ9876")
                    assert core.post(ROUTE, json=conflict).status_code == 409
                    with httpx.Client(base_url=java_origin, trust_env=False, timeout=3) as unauthorized:
                        assert unauthorized.get(API + "/sessions").status_code == 401
                        assert unauthorized.post(ROUTE, json=entry).status_code == 401
                    assert read("/dashboard")["active_sessions"] == 2
                    print("Invalid transition/conflicting ID=409; unauthenticated access=401; counts preserved")

                pending = create("CAM_ENTRADA", "QQQ1234")
                response = python.post(f"/api/v1/vision/events/{pending['event_id']}/send").json()
                delivery = response["transport_result"]
                assert delivery["state"] == "UNCERTAIN" and delivery["attempts"] == 3
                assert delivery["error"] in {"timeout", "network_error"}
                print(f"Java stopped: real FastAPI reports UNCERTAIN/{delivery['error']} after 3 attempts")

                with service(java_command, ROOT, environment, workspace / "java-restart.log", java_origin):
                    assert read("/dashboard")["active_sessions"] == 2
                    assert read("/sessions/" + session_id)["sector_id"] == "B"
                    for event, receipt, expected in list(receipts.values()):
                        response = core.post(ROUTE, json=event)
                        assert response.status_code == expected and response.json() == receipt
                    send(pending, 200)
                    verify_receipt(pending, 200)
                    full = create("CAM_A_B", "QQQ1234")
                    send(full, 409)
                    assert verify_receipt(full, 409)["error"] == "sector_full"
                    assert read("/dashboard")["active_sessions"] == 3
                    assert [s["occupied_estimated"] for s in read("/sectors")["items"]] == [1, 2]
                    print("Restart: sessions and receipts preserved; uncertain ENTRY recovered with same ID")
                    print("Full destination rejected with 409; estimates remain A=1, B=2 (capacity 2 each)")

        for log in workspace.glob("*.log"):
            text = log.read_text(encoding="utf-8", errors="replace")
            assert key not in text and all(plate not in text for plate in ("ABC1D23", "XYZ9876", "QQQ1234"))
        print("PASS: real FastAPI -> Spring Boot sessions; EXIT authorization remains BLOCKED pending JV-06")


if __name__ == "__main__":
    main()
