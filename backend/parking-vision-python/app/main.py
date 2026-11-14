from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import Settings, load_settings


class HealthResponse(BaseModel):
    status: Literal['ok'] = 'ok'


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings if settings is not None else load_settings()
    app = FastAPI(title='Parking Vision', version='0.1.0')
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=['GET'],
        allow_headers=[],
    )

    @app.get('/health', response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse()

    return app
