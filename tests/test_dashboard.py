from datetime import date, timedelta


def _fridge(start: date, days: int, kwh: float):
    return {"appliance_name": "Fridge", "category": "fridge", "start_date": start.isoformat(),
            "days_covered": days, "direct_kwh": kwh}


def test_empty_database_gives_zeros_not_errors(client):
    d = client.get("/api/dashboard?period=week").json()
    assert d["water"]["total_litres"] == 0
    assert d["electricity"]["total_kwh"] == 0
    assert d["comparison"]["water"]["available"] is False


def test_no_tariff_means_no_cost(client):
    client.post("/api/water", json={"activity_type": "bath", "occurred_at": f"{date.today()}T08:00:00", "direct_litres": 100})
    d = client.get("/api/dashboard?period=week").json()
    assert d["water"]["total_litres"] == 100
    assert d["water"]["cost"] is None


def test_tariff_gives_cost(client):
    client.put("/api/settings", json={"water_rate_per_m3": 30, "electricity_rate_per_kwh": 2.5})
    client.post("/api/water", json={"activity_type": "bath", "occurred_at": f"{date.today()}T08:00:00", "direct_litres": 1000})
    assert client.get("/api/dashboard?period=week").json()["water"]["cost"] == 30


def test_multi_day_record_not_double_counted(client):
    # 30 kWh over 30 days = 1 kWh/day. Two adjacent 15-day ranges must add up to 30.
    start = date(2026, 9, 1)
    client.post("/api/electricity", json=_fridge(start, 30, 30))
    a = client.get(f"/api/dashboard?start={start}&end={start + timedelta(days=14)}").json()
    b = client.get(f"/api/dashboard?start={start + timedelta(days=15)}&end={start + timedelta(days=29)}").json()
    assert abs(a["electricity"]["total_kwh"] + b["electricity"]["total_kwh"] - 30) < 0.01
    daily_total = sum(day["kwh"] for day in a["electricity"]["daily"])
    assert abs(daily_total - a["electricity"]["total_kwh"]) < 0.01


def test_comparison_needs_both_periods(client):
    today = date.today()
    client.post("/api/water", json={"activity_type": "bath", "occurred_at": f"{today}T08:00:00", "direct_litres": 100})
    assert client.get("/api/dashboard?period=week").json()["comparison"]["water"]["available"] is False
    last_week = today - timedelta(days=8)
    client.post("/api/water", json={"activity_type": "bath", "occurred_at": f"{last_week}T08:00:00", "direct_litres": 50})
    comp = client.get("/api/dashboard?period=week").json()["comparison"]["water"]
    assert comp["available"] is True
    assert comp["change_percent"] == 100.0


def test_bad_range_is_422(client):
    assert client.get("/api/dashboard?start=2026-10-10&end=2026-10-01").status_code == 422


def test_demo_data_is_labelled_and_removable(client):
    client.post("/api/demo")
    d = client.get("/api/dashboard?period=month").json()
    assert d["contains_demo_data"] is True
    assert d["tariffs"]["rates_are_illustrative"] is True
    client.delete("/api/demo")
    d = client.get("/api/dashboard?period=month").json()
    assert d["water"]["total_litres"] == 0
    assert d["tariffs"]["water_rate_per_m3"] is None