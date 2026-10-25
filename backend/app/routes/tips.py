"""Conservation tips: /api/tips"""
import json
from functools import lru_cache
from typing import Literal

from fastapi import APIRouter

from ..config import DATA_DIR

router = APIRouter(tags=["tips"])


@lru_cache
def _load_tips() -> list[dict]:
    return json.loads((DATA_DIR / "tips.json").read_text(encoding="utf-8"))


@router.get("/tips")
def list_tips(resource: Literal["water", "electricity"] | None = None):
    tips = _load_tips()
    return [t for t in tips if resource is None or t["resource"] == resource]