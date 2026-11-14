"""Configurable HTTP transport; no Spring Boot contract is presumed."""
import logging
import time
from threading import Lock
from typing import Literal
from urllib.parse import urlsplit
from uuid import UUID

import httpx
from pydantic import BaseModel, Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.events import VisionEvent

logger = logging.getLogger(__name__)


class DeliverySettings(BaseSettings):
    model_config = SettingsConfigDict(hide_input_in_errors=True)
    java_api_base_url: str | None = None
    java_events_endpoint: str | None = None
    internal_api_key: SecretStr | None = None
    java_timeout: float = Field(default=3, gt=0, le=60, allow_inf_nan=False)
    java_max_retries: int = Field(default=2, ge=0, le=3)
    java_retry_delay: float = Field(default=.2, ge=0, le=5, allow_inf_nan=False)
    java_idempotency_confirmed: bool = False

    @model_validator(mode='after')
    def target(self):
        if bool(self.java_api_base_url) != bool(self.java_events_endpoint):
            raise ValueError('Configure both base URL and endpoint, or neither')
        if self.java_api_base_url:
            base = urlsplit(self.java_api_base_url)
            endpoint = urlsplit(self.java_events_endpoint)
            if (base.scheme not in ('http', 'https') or not base.hostname or base.username is not None
                    or base.password is not None or base.query or base.fragment or base.path not in ('', '/')
                    or any(c.isspace() for c in self.java_api_base_url)):
                raise ValueError('Base URL must be an HTTP(S) origin without credentials')
            _ = base.port
            if (not self.java_events_endpoint.startswith('/') or endpoint.scheme or endpoint.netloc
                    or endpoint.query or endpoint.fragment or '\\' in self.java_events_endpoint
                    or any(c.isspace() for c in self.java_events_endpoint)):
                raise ValueError('Endpoint must be an absolute path, not another URL')
        if self.internal_api_key and any(ord(c) < 32 or ord(c) > 126 for c in self.internal_api_key.get_secret_value()):
            raise ValueError('Invalid internal API key')
        return self


class DeliveryResult(BaseModel):
    state: Literal['NOT_SENT', 'HTTP_ACKNOWLEDGED', 'FAILED', 'UNCERTAIN']
    attempts: int = 0
    http_status: int | None = None
    error: str | None = None


class JavaClient:
    def __init__(self, settings: DeliverySettings, *, transport=None):
        self.settings = settings
        self.transport = transport

    @property
    def enabled(self):
        return bool(self.settings.java_api_base_url)

    def send(self, event: VisionEvent) -> DeliveryResult:
        if not self.enabled:
            return DeliveryResult(state='NOT_SENT', error='integration_not_configured')
        headers = {'Content-Type': 'application/json'}
        if self.settings.internal_api_key:
            headers['X-Internal-API-Key'] = self.settings.internal_api_key.get_secret_value()
        payload = event.model_dump_json().encode('utf-8')
        attempts = 1 + (self.settings.java_max_retries if self.settings.java_idempotency_confirmed else 0)
        url = self.settings.java_api_base_url.rstrip('/') + self.settings.java_events_endpoint
        with httpx.Client(timeout=self.settings.java_timeout, transport=self.transport,
                          follow_redirects=False, trust_env=False) as client:
            for attempt in range(1, attempts + 1):
                try:
                    # Do not retain or log the response body: its schema is unconfirmed.
                    with client.stream('POST', url, headers=headers, content=payload) as response:
                        code = response.status_code
                    result = DeliveryResult(state='HTTP_ACKNOWLEDGED' if 200 <= code < 300 else
                                            'UNCERTAIN' if code >= 500 else 'FAILED',
                                            attempts=attempt, http_status=code,
                                            error=None if 200 <= code < 300 else 'http_error')
                    retryable = code in (500, 502, 503, 504)
                except httpx.TimeoutException:
                    result = DeliveryResult(state='UNCERTAIN', attempts=attempt, error='timeout')
                    retryable = True
                except httpx.RequestError:
                    result = DeliveryResult(state='UNCERTAIN', attempts=attempt, error='network_error')
                    retryable = True
                logger.info('delivery event_id=%s attempt=%s state=%s status=%s',
                            event.event_id, attempt, result.state, result.http_status)
                if not retryable or attempt == attempts:
                    return result
                time.sleep(self.settings.java_retry_delay)


class DeliveryLedger:
    """Local retry guard; never promises remote exactly-once or persistence."""
    def __init__(self, client: JavaClient):
        self.client = client
        self._results: dict[UUID, DeliveryResult] = {}
        self._lock = Lock()

    def result(self, event_id: UUID):
        with self._lock:
            return self._results.get(event_id)

    def send(self, event: VisionEvent):
        # MVP: serialize sends to prevent concurrent duplicates for one event.
        with self._lock:
            previous = self._results.get(event.event_id)
            if previous and previous.attempts and (
                previous.state == 'HTTP_ACKNOWLEDGED' or not self.client.settings.java_idempotency_confirmed
            ):
                return previous
            result = self.client.send(event)
            self._results[event.event_id] = result
            return result
