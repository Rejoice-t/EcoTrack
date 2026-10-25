"""Summaries for the dashboard and analytics: /api/dashboard"""
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.aggregation import build_summary, period_range

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard")
def dashboard(
    period: Literal["week", "month"] = "week",
    start: date | None = Query(default=None, description="Custom range start (overrides period)"),
    end: date | None = Query(default=None, description="Custom range end"),
    db: Session = Depends(get_db),
):
    if start or end:
        if not (start and end):
            raise HTTPException(status_code=422, detail="Give both start and end, or neither")
        if end < start:
            raise HTTPException(status_code=422, detail="end must be on or after start")
        if (end - start).days > 366:
            raise HTTPException(status_code=422, detail="Range can be at most one year")
    else:
        start, end = period_range(period)
    return build_summary(db, start, end)