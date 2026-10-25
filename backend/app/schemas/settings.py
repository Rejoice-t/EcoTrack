"""Household settings: tariffs and household size."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SettingsUpdate(BaseModel):
    water_rate_per_m3: float | None = Field(default=None, ge=0, le=10_000)
    electricity_rate_per_kwh: float | None = Field(default=None, ge=0, le=1_000)
    rates_are_illustrative: bool = False
    household_size: int | None = Field(default=None, ge=1, le=50)


class SettingsRead(SettingsUpdate):
    model_config = ConfigDict(from_attributes=True)
    updated_at: datetime