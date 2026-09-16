import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ["DATABASE_URL"] = "sqlite://"

from app.core.config import settings  # noqa: E402
from app.db.session import get_engine, get_session_factory  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402


@pytest.fixture()
def client(tmp_path):
    database = tmp_path / "nexia-test.db"
    settings.database_url = f"sqlite:///{database.as_posix()}"
    settings.upload_dir = tmp_path / "uploads"
    settings.gemini_api_key = None
    get_session_factory.cache_clear()
    get_engine.cache_clear()
    Base.metadata.create_all(get_engine())
    with TestClient(app) as test_client:
        yield test_client
    get_session_factory.cache_clear()
    get_engine.cache_clear()


@pytest.fixture()
def auth_headers(client):
    res = client.post(
        "/api/auth/register",
        json={
            "full_name": "Estudiante Prueba",
            "email": "estudiante.test@nexia.edu.co",
            "password": "password123",
            "institution_relation": "Estudiante",
            "shift": "JM",
            "course": "1001",
        },
    )
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def admin_headers(client):
    res = client.post(
        "/api/auth/login",
        json={
            "email": "admin@nexia.edu.co",
            "password": "admin123",
        },
    )
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
