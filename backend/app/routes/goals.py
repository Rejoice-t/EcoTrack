"""Budget goals: /api/goals"""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Goal
from ..schemas.goals import GoalCreate, GoalProgress
from ..services.goals import goal_progress

router = APIRouter(prefix="/goals", tags=["goals"])


def _get_or_404(db: Session, goal_id: int) -> Goal:
    goal = db.get(Goal, goal_id)
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


@router.get("", response_model=list[GoalProgress])
def list_goals(db: Session = Depends(get_db)):
    goals = db.scalars(select(Goal).order_by(Goal.period_end.desc(), Goal.id)).all()
    return [goal_progress(db, g) for g in goals]


@router.post("", response_model=GoalProgress, status_code=status.HTTP_201_CREATED)
def create_goal(payload: GoalCreate, db: Session = Depends(get_db)):
    goal = Goal(**payload.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal_progress(db, goal)


@router.put("/{goal_id}", response_model=GoalProgress)
def update_goal(goal_id: int, payload: GoalCreate, db: Session = Depends(get_db)):
    goal = _get_or_404(db, goal_id)
    for field, value in payload.model_dump().items():
        setattr(goal, field, value)
    db.commit()
    db.refresh(goal)
    return goal_progress(db, goal)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    db.delete(_get_or_404(db, goal_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)