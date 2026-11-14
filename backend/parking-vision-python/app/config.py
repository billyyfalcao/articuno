from pathlib import Path
from urllib.parse import urlsplit

from pydantic import ValidationError, field_validator
from pydantic_settings import SettingsConfigDict, SettingsError
from app.java_client import DeliverySettings


class Settings(DeliverySettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / '.env',
        env_file_encoding='utf-8',
        extra='forbid',
        hide_input_in_errors=True,
    )
    cors_origins: list[str] = ['http://localhost:5173', 'http://127.0.0.1:5173']
    video_root: Path = Path(__file__).resolve().parents[1] / 'videos'
    camera_config: Path = Path(__file__).resolve().parents[1] / 'cameras.example.json'

    @field_validator('cors_origins')
    @classmethod
    def validate_origins(cls, origins: list[str]) -> list[str]:
        for origin in origins:
            parsed = urlsplit(origin)
            if (
                parsed.scheme not in ('http', 'https')
                or not parsed.hostname
                or '*' in origin
                or parsed.username is not None
                or parsed.password is not None
                or parsed.path
                or parsed.query
                or parsed.fragment
                or any(char.isspace() for char in origin)
            ):
                raise ValueError('Use explicit HTTP(S) origins without paths or credentials')
            _ = parsed.port  # Validate port syntax and range.
        return origins


def load_settings() -> Settings:
    try:
        return Settings()
    except (ValidationError, SettingsError):
        raise RuntimeError(
            'Invalid configuration: check environment or .env (CORS_ORIGINS and delivery settings).'
        ) from None
