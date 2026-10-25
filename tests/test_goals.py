from datetime import date, timedelta


def test_goal_progress_from_recorded_data(client):
    today = date.today()
    goal = {"resource": "water", "title": "Month budget", "target_value": 1000,
            "period_start": (today - timedelta(days=5)).isoformat(),
            "period_end": (today + timedelta(days=5)).isoformat()}
    client.post("/api/goals", json=goal)
    client.post("/api/water", json={"activity_type": "bath", "occurred_at": f"{today}T08:00:00", "direct_litres": 900})
    g = client.get("/api/goals").json()[0]
    assert g["used"] == 900
    assert g["percent_used"] == 90
    assert g["status"] == "close"


def test_goal_over_budget(client):
    today = date.today()
    client.post("/api/goals", json={"resource": "water", "title": "Small", "target_value": 100,
                                    "period_start": today.isoformat(), "period_end": today.isoformat()})
    client.post("/api/water", json={"activity_type": "bath", "occurred_at": f"{today}T08:00:00", "direct_litres": 150})
    assert client.get("/api/goals").json()[0]["status"] == "over"


def test_goal_dates_validated(client):
    bad = {"resource": "water", "title": "x", "target_value": 10, "period_start": "2026-10-10", "period_end": "2026-10-01"}
    assert client.post("/api/goals", json=bad).status_code == 422