"""Electricity usage endpoints: /api/electricity"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ElectricityUsage
from ..schemas.electricity import ElectricityUsageCreate, ElectricityUsageRead
from ..services.calculations import electricity_kwh

router = APIRouter(prefix="/electricity", tags=["electricity"])


def _calculate(payload: ElectricityUsageCreate) -> float:
    return electricity_kwh(
        rated_watts=payload.rated_watts,
        hours_per_use=payload.hours_per_use or 0,
        uses_per_day=payload.uses_per_day,
        days_covered=payload.days_covered,
        direct_kwh=payload.direct_kwh,
    )


def _fields(payload: ElectricityUsageCreate) -> dict:
    # direct_kwh is an input only; the model stores the result in estimated_kwh
    return payload.model_dump(exclude={"direct_kwh"})


def _get_or_404(db: Session, usage_id: int) -> ElectricityUsage:
    usage = db.get(ElectricityUsage, usage_id)
    if usage is None:
        raise HTTPException(status_code=404, detail="Electricity record not found")
    return usage


@router.post("", response_model=ElectricityUsageRead, status_code=status.HTTP_201_CREATED)
def create_usage(payload: ElectricityUsageCreate, db: Session = Depends(get_db)):
    usage = ElectricityUsage(**_fields(payload), estimated_kwh=_calculate(payload))
    if payload.direct_kwh is not None:
        usage.rated_watts = None  # mark as "kWh entered directly"
    db.add(usage)
    db.commit()
    db.refresh(usage)
    return usage


@router.get("", response_model=list[ElectricityUsageRead])
def list_usage(start: date | None = None, end: date | None = None, db: Session = Depends(get_db)):
    query = select(ElectricityUsage).order_by(ElectricityUsage.start_date.desc(), ElectricityUsage.id.desc())
    rows = db.scalars(query).all()
    if start or end:
        lo, hi = start or date.min, end or date.max
        rows = [r for r in rows
                if r.start_date <= hi and r.start_date + timedelta(days=r.days_covered - 1) >= lo]
    return rows


@router.get("/{usage_id}", response_model=ElectricityUsageRead)
def get_usage(usage_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, usage_id)


@router.put("/{usage_id}", response_model=ElectricityUsageRead)
def update_usage(usage_id: int, payload: ElectricityUsageCreate, db: Session = Depends(get_db)):
    usage = _get_or_404(db, usage_id)
    for field, value in _fields(payload).items():
        setattr(usage, field, value)
    if payload.direct_kwh is not None:
        usage.rated_watts = None
    usage.estimated_kwh = _calculate(payload)
    db.commit()
    db.refresh(usage)
    return usage


@router.delete("/{usage_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_usage(usage_id: int, db: Session = Depends(get_db)):
    db.delete(_get_or_404(db, usage_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)