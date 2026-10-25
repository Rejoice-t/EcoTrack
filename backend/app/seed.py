"""Load or remove the FICTIONAL demo household (every row gets is_demo = True)."""
import json
import random
from datetime import date, datetime, time, timedelta

from sqlalchemy import delete
from sqlalchemy.orm import Session

from .config import DATA_DIR
from .models import ElectricityUsage, Goal, Settings, WaterActivity
from .services.calculations import electricity_kwh, water_litres

SEED_FILE = DATA_DIR / "seed_data.json"


def _vary(rng: random.Random, value: float, amount: float) -> float:
    return round(value * rng.uniform(1 - amount, 1 + amount), 2)


def clear_demo(db: Session) -> None:
    for model in (WaterActivity, ElectricityUsage, Goal):
        db.execute(delete(model).where(model.is_demo.is_(True)))
    settings = db.get(Settings, 1)
    if settings and settings.rates_are_illustrative:
        settings.water_rate_per_m3 = None
        settings.electricity_rate_per_kwh = None
        settings.rates_are_illustrative = False
    db.commit()


def load_demo(db: Session, today: date | None = None) -> dict:
    """Replace any existing demo rows with a fresh set dated up to today."""
    clear_demo(db)
    today = today or date.today()
    data = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    rng = random.Random(42)  # same "random" household every time
    first_day = today - timedelta(days=data["days"] - 1)
    counts = {"water": 0, "electricity": 0, "goals": 0}

    # Settings: only fill tariffs if the user has not set real ones
    settings = db.get(Settings, 1) or Settings(id=1)
    s = data["settings"]
    if settings.water_rate_per_m3 is None and settings.electricity_rate_per_kwh is None:
        settings.water_rate_per_m3 = s["water_rate_per_m3"]
        settings.electricity_rate_per_kwh = s["electricity_rate_per_kwh"]
        settings.rates_are_illustrative = True
    settings.household_size = settings.household_size or s["household_size"]
    db.add(settings)

    # Water activities
    for i in range(data["days"]):
        day = first_day + timedelta(days=i)
        for p in data["water_patterns"]:
            if i % p["every_days"]:
                continue
            duration = _vary(rng, p["duration_min"], p["vary"]) if "duration_min" in p else None
            direct = _vary(rng, p["direct_litres"], p["vary"]) if "direct_litres" in p else None
            flow = p.get("flow_rate_lpm")
            litres = water_litres(flow, duration, p["occurrences"], direct)
            db.add(WaterActivity(
                activity_type=p["activity_type"],
                occurred_at=datetime.combine(day, time(p["hour"], rng.choice([0, 15, 30, 45]))),
                duration_min=duration, flow_rate_lpm=flow, occurrences=p["occurrences"],
                direct_litres=direct, estimated_litres=litres,
                notes="Demo data", is_demo=True,
            ))
            counts["water"] += 1

    # Electricity: one record per appliance per week (days_covered = 7)
    for week_start in range(0, data["days"], 7):
        start = first_day + timedelta(days=week_start)
        days = min(7, data["days"] - week_start)
        for a in data["electricity_weekly"]:
            if "direct_kwh" in a:
                watts = hours = None
                uses = 1
                kwh = round(_vary(rng, a["direct_kwh"], a["vary"]) * days / 7, 2)
            else:
                watts, uses = a["rated_watts"], a["uses_per_day"]
                hours = _vary(rng, a["hours_per_use"], a["vary"])
                kwh = electricity_kwh(watts, hours, uses, days)
            db.add(ElectricityUsage(
                appliance_name=a["appliance_name"], category=a["category"],
                rated_watts=watts, hours_per_use=hours, uses_per_day=uses,
                start_date=start, days_covered=days, estimated_kwh=kwh,
                notes=a.get("notes", "Demo data"), is_demo=True,
            ))
            counts["electricity"] += 1

    # Electricity: single-day events
    for i in range(data["days"]):
        day = first_day + timedelta(days=i)
        for e in data["electricity_events"]:
            if i % e["every_days"]:
                continue
            kwh = electricity_kwh(e["rated_watts"], e["hours_per_use"], e["uses_per_day"], 1)
            db.add(ElectricityUsage(
                appliance_name=e["appliance_name"], category=e["category"],
                rated_watts=e["rated_watts"], hours_per_use=e["hours_per_use"],
                uses_per_day=e["uses_per_day"], start_date=day, days_covered=1,
                estimated_kwh=kwh, notes="Demo data", is_demo=True,
            ))
            counts["electricity"] += 1

    # Goals for the current calendar month
    month_start = today.replace(day=1)
    next_month = (month_start + timedelta(days=32)).replace(day=1)
    for g in data["goals"]:
        db.add(Goal(
            resource=g["resource"], title=g["title"], target_value=g["target_value"],
            period_start=month_start, period_end=next_month - timedelta(days=1), is_demo=True,
        ))
        counts["goals"] += 1

    db.commit()
    return counts