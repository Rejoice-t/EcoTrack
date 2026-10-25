"""Database tables, written as Python classes."""
from datetime import date, datetime, timezone
from contextlib import asynccontextmanager
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column


from .database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class WaterActivity(Base):
    __tablename__ = "water_activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    activity_type: Mapped[str] = mapped_column(String(30))
    occurred_at: Mapped[datetime]
        # Inputs (optional: either flow + duration, or direct litres)
    duration_min: Mapped[float | None]
    flow_rate_lpm: Mapped[float | None]
    occurrences: Mapped[int] = mapped_column(default=1)
    direct_litres: Mapped[float | None]

    # Result of calculations.water_litres(), stored when the record is saved
    estimated_litres: Mapped[float]

    notes: Mapped[str | None] = mapped_column(String(200))
    is_demo: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now)

class ElectricityUsage(Base):
    __tablename__ = "electricity_usage"

    id: Mapped[int] = mapped_column(primary_key=True)
    appliance_name: Mapped[str] = mapped_column(String(60))
    category: Mapped[str] = mapped_column(String(30))

    # Inputs. If rated_watts is empty, the user typed the kWh in directly.
    rated_watts: Mapped[float | None]
    hours_per_use: Mapped[float | None]
    uses_per_day: Mapped[int] = mapped_column(default=1)

    # The period this record covers (a fridge for a month = 30 days)
    start_date: Mapped[date]
    days_covered: Mapped[int] = mapped_column(default=1)

    estimated_kwh: Mapped[float]

    notes: Mapped[str | None] = mapped_column(String(200))
    is_demo: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now)

class Settings(Base):
    """Household settings. The app always uses the row with id = 1."""
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Tariffs in N$. Empty means "not set" -> the app shows no cost.
    water_rate_per_m3: Mapped[float | None]
    electricity_rate_per_kwh: Mapped[float | None]
    rates_are_illustrative: Mapped[bool] = mapped_column(default=False)

    household_size: Mapped[int | None]
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now)

    

class Goal(Base):
    """A budget goal: stay under a target amount of water (L) or electricity (kWh)."""
    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    resource: Mapped[str] = mapped_column(String(20))      # "water" | "electricity"
    title: Mapped[str] = mapped_column(String(80))
    target_value: Mapped[float]                             # litres or kWh
    period_start: Mapped[date]
    period_end: Mapped[date]
    is_demo: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(default=utc_now, onupdate=utc_now)