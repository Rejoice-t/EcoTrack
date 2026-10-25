SHOWER = {"activity_type": "shower", "occurred_at": "2026-10-20T07:00:00", "duration_min": 10, "flow_rate_lpm": 9}


def test_create_calculates_litres(client):
    r = client.post("/api/water", json=SHOWER)
    assert r.status_code == 201
    assert r.json()["estimated_litres"] == 90


def test_list_is_newest_first(client):
    client.post("/api/water", json={**SHOWER, "occurred_at": "2026-10-18T07:00:00"})
    client.post("/api/water", json=SHOWER)
    dates = [a["occurred_at"] for a in client.get("/api/water").json()]
    assert dates == sorted(dates, reverse=True)


def test_update_recalculates(client):
    created = client.post("/api/water", json=SHOWER).json()
    r = client.put(f"/api/water/{created['id']}", json={**SHOWER, "duration_min": 5})
    assert r.status_code == 200
    assert r.json()["estimated_litres"] == 45


def test_delete_then_404(client):
    created = client.post("/api/water", json=SHOWER).json()
    assert client.delete(f"/api/water/{created['id']}").status_code == 204
    assert client.get(f"/api/water/{created['id']}").status_code == 404


def test_missing_record_is_404(client):
    assert client.put("/api/water/999", json=SHOWER).status_code == 404
    assert client.delete("/api/water/999").status_code == 404


def test_invalid_input_is_422(client):
    assert client.post("/api/water", json={**SHOWER, "duration_min": -1}).status_code == 422
    assert client.post("/api/water", json={**SHOWER, "activity_type": "swimming"}).status_code == 422
    no_flow = {"activity_type": "shower", "occurred_at": "2026-10-20T07:00:00", "duration_min": 10}
    assert client.post("/api/water", json=no_flow).status_code == 422