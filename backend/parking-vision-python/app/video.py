from pathlib import Path
from threading import Event, Lock, Thread
from collections import deque
from uuid import uuid4
from datetime import datetime, timezone

import cv2
from fastapi import HTTPException
from pydantic import BaseModel, Field
from app.ocr import PlateReader


class StartRequest(BaseModel):
    filename: str = Field(min_length=1)
    sample_every: int = Field(default=5, ge=1, le=10000, strict=True)
    ocr: bool = False
    confidence_threshold: float = Field(default=.8, ge=0, le=1)
    roi: tuple[int, int, int, int] | None = None


class VideoProcessor:
    """One local job; optional OCR retains at most 50 recent JPEG evidences."""

    def __init__(self, root: Path, tesseract_cmd='tesseract'):
        self.root = root.resolve()
        self.lock = Lock()
        self.stop_event = Event()
        self.thread: Thread | None = None
        self.tesseract_cmd = tesseract_cmd
        self.detections = deque(maxlen=50)
        self.evidence = {}
        self.data = dict(state='idle', filename=None, sample_every=None,
                         frames_read=0, frames_sampled=0, error=None)

    def status(self):
        with self.lock:
            return self.data.copy()

    def results(self, limit):
        with self.lock:
            return list(self.detections)[-limit:]

    def image(self, detection_id):
        with self.lock:
            value = self.evidence.get(detection_id)
        if value is None:
            raise HTTPException(404, 'Evidencia ausente ou expirada.')
        return value

    def start(self, request: StartRequest):
        if request.roi and (min(request.roi[:2]) < 0 or min(request.roi[2:]) <= 0):
            raise HTTPException(422, 'ROI deve ser [x,y,largura,altura] em pixels positivos.')
        # Only direct local filenames inside the operator-configured directory.
        if any(c in request.filename for c in '/\\:\x00') or Path(request.filename).suffix.lower() != '.mp4':
            raise HTTPException(422, 'Informe apenas o nome de um arquivo MP4 local.')
        try:
            path = (self.root / request.filename).resolve()
        except (OSError, ValueError):
            raise HTTPException(422, 'Nome de arquivo local invalido.') from None
        if not path.is_relative_to(self.root):
            raise HTTPException(422, 'Arquivo fora da pasta de videos autorizada.')
        if not path.is_file():
            raise HTTPException(404, 'Video nao encontrado na pasta configurada.')
        with self.lock:
            if self.thread is not None and self.thread.is_alive():
                raise HTTPException(409, 'Ja existe uma analise ativa.')
            self.stop_event.clear()
            self.detections.clear()
            self.evidence.clear()
            self.data = dict(state='running', filename=request.filename,
                             sample_every=request.sample_every, frames_read=0,
                             frames_sampled=0, error=None)
            self.thread = Thread(target=self._run, args=(path, request), daemon=True)
            self.thread.start()
            return self.data.copy()

    def stop(self):
        with self.lock:
            if self.data['state'] in ('running', 'stopping'):
                self.stop_event.set()
                self.data['state'] = 'stopping'
            return self.data.copy()

    def close(self):
        self.stop()
        if self.thread is not None:
            self.thread.join(timeout=5)

    def _run(self, path, request):
        capture = None
        state, error = 'completed', None
        count = 0
        try:
            capture = cv2.VideoCapture(str(path))
            if not capture.isOpened():
                raise ValueError('unreadable')
            total = capture.get(cv2.CAP_PROP_FRAME_COUNT)
            fps = capture.get(cv2.CAP_PROP_FPS)
            reader = PlateReader(self.tesseract_cmd, request.confidence_threshold)
            while not self.stop_event.is_set():
                ok, frame = capture.read()
                if not ok:
                    if count == 0 or (total > 0 and count < total):
                        raise ValueError('incomplete')
                    break
                if frame is None or frame.size == 0:
                    raise ValueError('empty frame')
                count += 1
                with self.lock:
                    self.data['frames_read'] = count
                    if (count - 1) % request.sample_every == 0:
                        self.data['frames_sampled'] += 1
                if request.ocr and (count - 1) % request.sample_every == 0:
                    try:
                        readings = reader.read(frame, request.roi)
                        ok, encoded = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
                        if not ok:
                            raise ValueError('encoding failed')
                    except Exception:
                        with self.lock:
                            self.data['ocr_error'] = 'OCR indisponivel: confira Tesseract, idioma eng e ROI; use confirmacao assistida.'
                        continue
                    with self.lock:
                        self.data['ocr_error'] = None
                        for reading in readings:
                            detection_id = uuid4().hex
                            if len(self.detections) == self.detections.maxlen:
                                self.evidence.pop(self.detections[0]['id'], None)
                            self.evidence[detection_id] = encoded.tobytes()
                            self.detections.append(dict(
                                **reading, id=detection_id, filename=path.name,
                                frame_index=count - 1, video_time_seconds=(count - 1) / fps if fps > 0 else None,
                                detected_at=datetime.now(timezone.utc).isoformat(),
                                evidence_url=f'/api/v1/vision/detections/{detection_id}/frame',
                            ))
        except Exception:
            state, error = 'error', 'Nao foi possivel ler o video; verifique integridade, codec e permissoes.'
        finally:
            if capture is not None:
                capture.release()
            with self.lock:
                if self.stop_event.is_set():
                    state, error = 'stopped', None
                self.data.update(state=state, error=error)
