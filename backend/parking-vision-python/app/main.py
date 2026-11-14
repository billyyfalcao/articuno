from typing import Literal
from contextlib import asynccontextmanager
import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pydantic import ValidationError

from app.config import Settings, load_settings
from app.video import StartRequest, VideoProcessor
from app.events import CameraMap
from app.simulator import simulator_router


class HealthResponse(BaseModel):
    status: Literal['ok'] = 'ok'


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings if settings is not None else load_settings()
    processor = VideoProcessor(settings.video_root)
    try:
        camera_map = CameraMap.model_validate_json(settings.camera_config.read_text(encoding='utf-8'))
    except (OSError, ValueError, ValidationError):
        raise RuntimeError('Invalid camera configuration: check CAMERA_CONFIG JSON file.') from None

    @asynccontextmanager
    async def lifespan(app):
        yield
        await asyncio.to_thread(processor.close)

    app = FastAPI(title='Parking Vision', version='0.1.0', lifespan=lifespan)
    app.include_router(simulator_router(camera_map))
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=['GET', 'POST'],
        allow_headers=['Content-Type'],
    )

    @app.get('/health', response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse()

    @app.get('/api/v1/vision/status')
    def status():
        return processor.status()

    @app.post('/api/v1/vision/analyze/start', status_code=202)
    def start(request: StartRequest):
        return processor.start(request)

    @app.post('/api/v1/vision/analyze/stop')
    def stop():
        return processor.stop()

    return app
