"""Pydantic schemas: the shape of water data going IN to and OUT of the API."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

ActivityType = Literal[
    "shower", "bath", "dishes", "laundry",
    "cleaning", "handwashing", "gardening", "other",
]

class WaterActivityCreate(BaseModel):
    """What the user sends when logging a water activity."""
    activity_type: ActivityType
    occurred_at: datetime
    duration_min: float | None = Field(default=None, ge=0, le=1440)
    flow_rate_lpm: float | None = Field(default=None, ge=0, le=100)
    occurrences: int = Field(default=1, ge=1, le=100)
    direct_litres: float | None = Field(default=None, ge=0, le=100_000)
    notes: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def check_enough_inputs(self):
        has_flow = self.duration_min is not None and self.flow_rate_lpm is not None
        if self.direct_litres is None and not has_flow:
            raise ValueError("Give either direct_litres, or both duration_min and flow_rate_lpm")
        return self


class WaterActivityRead(WaterActivityCreate):
    """What the API sends back: the input plus the saved and calculated fields."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    estimated_litres: float
    is_demo: bool
    created_at: datetime
    updated_at: datetime    