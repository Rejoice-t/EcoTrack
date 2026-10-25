"""Water activity endpoints: /api/water"""
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import WaterActivity
from ..schemas.water import WaterActivityCreate, WaterActivityRead
from ..services.calculations import water_litres

router = APIRouter(prefix="/water", tags=["water"])


def _calculate(payload: WaterActivityCreate) -> float:
    return water_litres(
        flow_rate_lpm=payload.flow_rate_lpm,
        duration_min=payload.duration_min,
        occurrences=payload.occurrences,
        direct_litres=payload.direct_litres,
    )


def _get_or_404(db: Session, activity_id: int) -> WaterActivity:
    activity = db.get(WaterActivity, activity_id)
    if activity is None:
        raise HTTPException(status_code=404, detail="Water activity not found")
    return activity


@router.post("", response_model=WaterActivityRead, status_code=status.HTTP_201_CREATED)
def create_water_activity(payload: WaterActivityCreate, db: Session = Depends(get_db)):
    activity = WaterActivity(**payload.model_dump(), estimated_litres=_calculate(payload))
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


@router.get("", response_model=list[WaterActivityRead])
def list_water_activities(
    start: date | None = None,
    end: date | None = None,
    db: Session = Depends(get_db),
):
    query = select(WaterActivity).order_by(WaterActivity.occurred_at.desc())
    if start:
        query = query.where(WaterActivity.occurred_at >= datetime.combine(start, time.min))
    if end:
        query = query.where(WaterActivity.occurred_at < datetime.combine(end + timedelta(days=1), time.min))
    return db.scalars(query).all()


@router.get("/{activity_id}", response_model=WaterActivityRead)
def get_water_activity(activity_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, activity_id)


@router.put("/{activity_id}", response_model=WaterActivityRead)
def update_water_activity(activity_id: int, payload: WaterActivityCreate, db: Session = Depends(get_db)):
    activity = _get_or_404(db, activity_id)
    for field, value in payload.model_dump().items():
        setattr(activity, field, value)
    activity.estimated_litres = _calculate(payload)
    db.commit()
    db.refresh(activity)
    return activity


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_water_activity(activity_id: int, db: Session = Depends(get_db)):
    db.delete(_get_or_404(db, activity_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)