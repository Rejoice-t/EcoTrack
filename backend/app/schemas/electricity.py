"""Pydantic schemas for electricity usage records."""
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Category = Literal[
    "kettle", "geyser", "fridge", "washing_machine",
    "iron", "heater", "lighting", "stove", "other",
]


class ElectricityUsageCreate(BaseModel):
    """What the user sends when logging appliance usage.

    Either rated_watts + hours_per_use (we estimate the kWh),
    or direct_kwh (the user already knows the kWh, e.g. from a fridge energy label).
    """
    appliance_name: str = Field(min_length=1, max_length=60)
    category: Category
    rated_watts: float | None = Field(default=None, ge=0, le=20_000)
    hours_per_use: float | None = Field(default=None, ge=0, le=24)
    uses_per_day: int = Field(default=1, ge=1, le=100)
    start_date: date
    days_covered: int = Field(default=1, ge=1, le=366)
    direct_kwh: float | None = Field(default=None, ge=0, le=100_000)
    notes: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def check_enough_inputs(self):
        has_power = self.rated_watts is not None and self.hours_per_use is not None
        if self.direct_kwh is None and not has_power:
            raise ValueError("Give either direct_kwh, or both rated_watts and hours_per_use")
        return self


class ElectricityUsageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    appliance_name: str
    category: str
    rated_watts: float | None
    hours_per_use: float | None
    uses_per_day: int
    start_date: date
    days_covered: int
    estimated_kwh: float
    notes: str | None
    is_demo: bool
    created_at: datetime
    updated_at: datetime