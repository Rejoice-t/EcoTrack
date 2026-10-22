from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_frontend_is_served():
    response = client.get("/")
    assert response.status_code == 200
    assert "EcoTrack" in response.text