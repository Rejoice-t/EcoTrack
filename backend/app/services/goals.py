"""Goal progress, based only on recorded data."""
from datetime import date

from sqlalchemy.orm import Session

from ..models import Goal
from .aggregation import build_summary


def goal_progress(db: Session, goal: Goal, today: date | None = None) -> dict:
    today = today or date.today()
    days_total = (goal.period_end - goal.period_start).days + 1

    if today < goal.period_start:
        used, days_elapsed = 0.0, 0
    else:
        summary = build_summary(db, goal.period_start, goal.period_end, include_previous=False)
        used = (summary["water"]["total_litres"] if goal.resource == "water"
                else summary["electricity"]["total_kwh"])
        days_elapsed = min((today - goal.period_start).days + 1, days_total)

    percent = round(used / goal.target_value * 100, 1)
    if days_elapsed == 0:
        status = "not_started"
    elif percent >= 100:
        status = "over"
    elif percent >= 85:
        status = "close"
    else:
        status = "on_track"

    return {
        "id": goal.id,
        "resource": goal.resource,
        "title": goal.title,
        "target_value": goal.target_value,
        "period_start": goal.period_start,
        "period_end": goal.period_end,
        "is_demo": goal.is_demo,
        "used": round(used, 1),
        "percent_used": percent,
        "unit": "L" if goal.resource == "water" else "kWh",
        "status": status,
        "days_elapsed": days_elapsed,
        "days_total": days_total,
    }