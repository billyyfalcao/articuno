from typing import Literal
from contextlib import asynccontextmanager
import asyncio

from fastapi import FastAPI, Query
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import Settings, load_settings
from app.video import StartRequest, VideoProcessor


class HealthResponse(BaseModel):
    status: Literal['ok'] = 'ok'


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings if settings is not None else load_settings()
    processor = VideoProcessor(settings.video_root, settings.tesseract_cmd)

    @asynccontextmanager
    async def lifespan(app):
        yield
        await asyncio.to_thread(processor.close)

    app = FastAPI(title='Parking Vision', version='0.1.0', lifespan=lifespan)
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

    @app.get('/api/v1/vision/detections')
    def detections(limit: int = Query(default=20, ge=1, le=50)):
        return processor.results(limit)

    @app.get('/api/v1/vision/detections/{detection_id}/frame')
    def evidence(detection_id: str):
        return Response(processor.image(detection_id), media_type='image/jpeg',
                        headers={'Cache-Control': 'no-store'})

    return app
