KETTLE = {"appliance_name": "Kettle", "category": "kettle", "rated_watts": 2000,
          "hours_per_use": 0.05, "uses_per_day": 4, "start_date": "2026-10-01", "days_covered": 7}


def test_create_calculates_kwh(client):
    r = client.post("/api/electricity", json=KETTLE)
    assert r.status_code == 201
    assert abs(r.json()["estimated_kwh"] - 2.8) < 1e-9


def test_direct_kwh_when_watts_unknown(client):
    fridge = {"appliance_name": "Fridge", "category": "fridge", "start_date": "2026-10-01",
              "days_covered": 30, "direct_kwh": 35}
    r = client.post("/api/electricity", json=fridge)
    assert r.status_code == 201
    assert r.json()["estimated_kwh"] == 35
    assert r.json()["rated_watts"] is None


def test_missing_watts_and_kwh_is_422(client):
    bad = {**KETTLE, "rated_watts": None}
    assert client.post("/api/electricity", json=bad).status_code == 422


def test_update_and_delete(client):
    created = client.post("/api/electricity", json=KETTLE).json()
    r = client.put(f"/api/electricity/{created['id']}", json={**KETTLE, "days_covered": 14})
    assert abs(r.json()["estimated_kwh"] - 5.6) < 1e-9
    assert client.delete(f"/api/electricity/{created['id']}").status_code == 204
    assert client.get(f"/api/electricity/{created['id']}").status_code == 404