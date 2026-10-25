"""Demo data controls: /api/demo (fictional household, always labelled)."""
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..seed import clear_demo, load_demo

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("")
def load_demo_data(db: Session = Depends(get_db)):
    return {"loaded": load_demo(db)}


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def remove_demo_data(db: Session = Depends(get_db)):
    clear_demo(db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)