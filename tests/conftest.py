"""Shared test setup: every test run uses a throwaway SQLite file, never ecotrack.db."""
import os
import tempfile

_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.name}"
os.environ["N8N_WEBHOOK_URL"] = ""      # tests start with the AI coach switched off
os.environ["N8N_SHARED_SECRET"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    """A test client with an empty database for each test."""
    Base.metadata.drop_all(engine)
    with TestClient(app) as c:   # 'with' runs the lifespan: tables + settings row
        yield c