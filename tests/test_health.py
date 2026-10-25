def test_health_returns_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_frontend_is_served(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "EcoTrack" in response.text