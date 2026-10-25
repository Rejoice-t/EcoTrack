"""Turns stored records into totals, rankings and daily series for a date range.

Every figure here is an ESTIMATE derived from recorded activities.
"""
from collections import defaultdict
from datetime import date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import ElectricityUsage, Settings, WaterActivity
from .calculations import electricity_cost, kwh_within_range, water_cost

PERIOD_DAYS = {"week": 7, "month": 30}


def period_range(period: str, today: date | None = None) -> tuple[date, date]:
    """'week' = the last 7 days including today; 'month' = the last 30 days."""
    today = today or date.today()
    return today - timedelta(days=PERIOD_DAYS[period] - 1), today


def previous_range(start: date, end: date) -> tuple[date, date]:
    """The window of equal length that ends the day before `start`."""
    length = (end - start).days + 1
    prev_end = start - timedelta(days=1)
    return prev_end - timedelta(days=length - 1), prev_end


def _days(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def water_in_range(db: Session, start: date, end: date) -> list[WaterActivity]:
    query = select(WaterActivity).where(
        WaterActivity.occurred_at >= datetime.combine(start, time.min),
        WaterActivity.occurred_at < datetime.combine(end + timedelta(days=1), time.min),
    )
    return list(db.scalars(query))


def electricity_overlapping(db: Session, start: date, end: date) -> list[ElectricityUsage]:
    """Records that cover at least one day inside [start, end]."""
    candidates = db.scalars(select(ElectricityUsage).where(ElectricityUsage.start_date <= end))
    return [
        r for r in candidates
        if r.start_date + timedelta(days=r.days_covered - 1) >= start
    ]


def build_summary(db: Session, start: date, end: date, include_previous: bool = True) -> dict:
    settings = db.get(Settings, 1)
    water_rate = settings.water_rate_per_m3 if settings else None
    power_rate = settings.electricity_rate_per_kwh if settings else None

    days = _days(start, end)
    water_daily = {d: 0.0 for d in days}
    power_daily = {d: 0.0 for d in days}

    # ---- Water: each activity belongs to the day it happened ----
    water_rows = water_in_range(db, start, end)
    by_activity: dict[str, float] = defaultdict(float)
    for row in water_rows:
        water_daily[row.occurred_at.date()] += row.estimated_litres
        by_activity[row.activity_type] += row.estimated_litres

    # ---- Electricity: spread each record evenly over its days ----
    power_rows = electricity_overlapping(db, start, end)
    by_appliance: dict[str, dict] = {}
    for row in power_rows:
        per_day = row.estimated_kwh / row.days_covered
        for i in range(row.days_covered):
            d = row.start_date + timedelta(days=i)
            if start <= d <= end:
                power_daily[d] += per_day
        in_range = kwh_within_range(row.estimated_kwh, row.start_date, row.days_covered, start, end)
        key = row.appliance_name.strip()
        entry = by_appliance.setdefault(key, {"name": key, "category": row.category, "kwh": 0.0})
        entry["kwh"] += in_range

    total_litres = sum(water_daily.values())
    total_kwh = sum(power_daily.values())

    water_ranked = [
        {
            "name": name,
            "litres": round(litres, 1),
            "share": round(litres / total_litres * 100, 1) if total_litres else 0.0,
            "cost": _round(water_cost(litres, water_rate)),
        }
        for name, litres in sorted(by_activity.items(), key=lambda kv: kv[1], reverse=True)
    ]
    power_ranked = [
        {
            "name": e["name"],
            "category": e["category"],
            "kwh": round(e["kwh"], 2),
            "share": round(e["kwh"] / total_kwh * 100, 1) if total_kwh else 0.0,
            "cost": _round(electricity_cost(e["kwh"], power_rate)),
        }
        for e in sorted(by_appliance.values(), key=lambda e: e["kwh"], reverse=True)
        if e["kwh"] > 0
    ]

    summary = {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "days": len(days),
        "water": {
            "total_litres": round(total_litres, 1),
            "daily_average_litres": round(total_litres / len(days), 1),
            "cost": _round(water_cost(total_litres, water_rate)),
            "record_count": len(water_rows),
            "by_activity": water_ranked,
            "daily": [{"date": d.isoformat(), "litres": round(v, 1)} for d, v in water_daily.items()],
        },
        "electricity": {
            "total_kwh": round(total_kwh, 2),
            "daily_average_kwh": round(total_kwh / len(days), 2),
            "cost": _round(electricity_cost(total_kwh, power_rate)),
            "record_count": len(power_rows),
            "by_appliance": power_ranked,
            "daily": [{"date": d.isoformat(), "kwh": round(v, 2)} for d, v in power_daily.items()],
        },
        "tariffs": {
            "water_rate_per_m3": water_rate,
            "electricity_rate_per_kwh": power_rate,
            "rates_are_illustrative": bool(settings and settings.rates_are_illustrative),
        },
        "contains_demo_data": any(r.is_demo for r in water_rows) or any(r.is_demo for r in power_rows),
        "data_basis": "estimate",
    }

    if include_previous:
        prev_start, prev_end = previous_range(start, end)
        prev = build_summary(db, prev_start, prev_end, include_previous=False)
        summary["comparison"] = {
            "previous_start": prev["start"],
            "previous_end": prev["end"],
            "water": _compare(
                summary["water"]["total_litres"], prev["water"]["total_litres"],
                summary["water"]["record_count"], prev["water"]["record_count"],
            ),
            "electricity": _compare(
                summary["electricity"]["total_kwh"], prev["electricity"]["total_kwh"],
                summary["electricity"]["record_count"], prev["electricity"]["record_count"],
            ),
        }
    return summary


def _compare(current: float, previous: float, current_count: int, previous_count: int) -> dict:
    """Only compare when BOTH periods have records; otherwise say so."""
    if current_count == 0 or previous_count == 0 or previous == 0:
        return {"available": False, "previous": None, "change_percent": None}
    return {
        "available": True,
        "previous": previous,
        "change_percent": round((current - previous) / previous * 100, 1),
    }


def _round(value: float | None) -> float | None:
    return None if value is None else round(value, 2)