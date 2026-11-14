from pathlib import Path
from threading import Event, Lock, Thread

import cv2
from fastapi import HTTPException
from pydantic import BaseModel, Field


class StartRequest(BaseModel):
    filename: str = Field(min_length=1)
    sample_every: int = Field(default=5, ge=1, le=10000, strict=True)


class VideoProcessor:
    """One local job per server process; frames are counted, not retained."""

    def __init__(self, root: Path):
        self.root = root.resolve()
        self.lock = Lock()
        self.stop_event = Event()
        self.thread: Thread | None = None
        self.data = dict(state='idle', filename=None, sample_every=None,
                         frames_read=0, frames_sampled=0, error=None)

    def status(self):
        with self.lock:
            return self.data.copy()

    def start(self, request: StartRequest):
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
            self.data = dict(state='running', filename=request.filename,
                             sample_every=request.sample_every, frames_read=0,
                             frames_sampled=0, error=None)
            self.thread = Thread(target=self._run, args=(path, request.sample_every), daemon=True)
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

    def _run(self, path, sample_every):
        capture = None
        state, error = 'completed', None
        count = 0
        try:
            capture = cv2.VideoCapture(str(path))
            if not capture.isOpened():
                raise ValueError('unreadable')
            total = capture.get(cv2.CAP_PROP_FRAME_COUNT)
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
                    if (count - 1) % sample_every == 0:
                        self.data['frames_sampled'] += 1
        except Exception:
            state, error = 'error', 'Nao foi possivel ler o video; verifique integridade, codec e permissoes.'
        finally:
            release_failed = False
            if capture is not None:
                try:
                    capture.release()
                except Exception:
                    release_failed = True
                    state, error = 'error', 'Falha ao liberar a captura de video; reinicie o servico.'
            with self.lock:
                if self.stop_event.is_set() and not release_failed:
                    state, error = 'stopped', None
                self.data.update(state=state, error=error)
