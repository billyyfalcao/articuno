import pytest
from fastapi.testclient import TestClient

from app.config import Settings, load_settings
from app.main import create_app


def test_health():
    with TestClient(create_app(Settings(_env_file=None))) as client:
        response = client.get('/health')
    assert response.status_code == 200
    assert response.json() == {'status': 'ok'}


@pytest.mark.parametrize('origin,allowed', [('http://localhost:5173', True), ('https://untrusted.example', False)])
def test_cors(origin, allowed):
    with TestClient(create_app(Settings(_env_file=None))) as client:
        response = client.options('/health', headers={'Origin': origin, 'Access-Control-Request-Method': 'GET'})
    assert (response.status_code == 200) == allowed
    assert response.headers.get('access-control-allow-origin') == (origin if allowed else None)


@pytest.mark.parametrize('value', ['*', '["*"]', '["https://user:secret@example.com"]', '["http://localhost/path"]', 'secret-invalid-json'])
def test_invalid_config_is_redacted(monkeypatch, value):
    monkeypatch.setenv('CORS_ORIGINS', value)
    with pytest.raises(RuntimeError) as error:
        load_settings()
    assert str(error.value) == 'Invalid configuration: check environment or .env (CORS_ORIGINS and delivery settings).'
    assert value not in str(error.value)


def test_dotenv_and_environment_precedence(tmp_path, monkeypatch):
    env_file = tmp_path / '.env'
    env_file.write_text('CORS_ORIGINS=["http://localhost:3000"]', encoding='utf-8')
    monkeypatch.delenv('CORS_ORIGINS', raising=False)
    assert Settings(_env_file=env_file).cors_origins == ['http://localhost:3000']
    monkeypatch.setenv('CORS_ORIGINS', '["http://localhost:5173"]')
    assert Settings(_env_file=env_file).cors_origins == ['http://localhost:5173']
