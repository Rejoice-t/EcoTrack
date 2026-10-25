"""Budget goals."""
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Resource = Literal["water", "electricity"]


class GoalCreate(BaseModel):
    resource: Resource
    title: str = Field(min_length=1, max_length=80)
    target_value: float = Field(gt=0, le=1_000_000)
    period_start: date
    period_end: date

    @model_validator(mode="after")
    def check_dates(self):
        if self.period_end < self.period_start:
            raise ValueError("period_end must be on or after period_start")
        return self


class GoalRead(GoalCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_demo: bool


class GoalProgress(GoalRead):
    used: float                 # litres or kWh recorded so far in the period
    percent_used: float         # used / target x 100
    unit: str                   # "L" or "kWh"
    status: Literal["on_track", "close", "over", "not_started"]
    days_elapsed: int
    days_total: int
    