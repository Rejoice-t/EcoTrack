"""AI Resource Coach: /api/coach"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Goal
from ..schemas.coach import CoachRequest, CoachResponse
from ..services.aggregation import build_summary, period_range
from ..services.coach import ask_coach
from ..services.goals import goal_progress

router = APIRouter(tags=["coach"])


@router.post("/coach", response_model=CoachResponse)
def coach(payload: CoachRequest, db: Session = Depends(get_db)):
    start, end = period_range(payload.period)
    summary = build_summary(db, start, end)
    goals = [goal_progress(db, g) for g in db.scalars(select(Goal))]
    return ask_coach(payload.question, payload.period, summary, goals)