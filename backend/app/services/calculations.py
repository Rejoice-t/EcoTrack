"""Pure calculation functions for EcoTrack.

"Pure" means: no database, no web requests, no hidden state.
Same inputs always give the same output, which makes them easy to test.

All results are ESTIMATES based on what the user recorded.
"""
from datetime import date, timedelta

LITRES_PER_CUBIC_METRE = 1000
WATTS_PER_KILOWATT = 1000


def _require_non_negative(name: str, value: float) -> None:
    """Stop early with a clear message if a value is negative."""
    if value < 0:
        raise ValueError(f"{name} cannot be negative (got {value})")


# ---------- Water ----------

def water_litres(
    flow_rate_lpm: float | None,
    duration_min: float | None,
    occurrences: int = 1,
    direct_litres: float | None = None,
) -> float:
    """Estimated litres for a water activity.

    If the user knows the litres directly (e.g. a 10 L bucket), use that.
    Otherwise: flow rate (L/min) x duration (min) x occurrences.
    """
    _require_non_negative("occurrences", occurrences)

    if direct_litres is not None:
        _require_non_negative("direct_litres", direct_litres)
        return direct_litres * occurrences

    if flow_rate_lpm is None or duration_min is None:
        raise ValueError("Provide either direct_litres, or both flow_rate_lpm and duration_min")

    _require_non_negative("flow_rate_lpm", flow_rate_lpm)
    _require_non_negative("duration_min", duration_min)
    return flow_rate_lpm * duration_min * occurrences


# ---------- Electricity ----------

def electricity_kwh(
    rated_watts: float | None,
    hours_per_use: float,
    uses_per_day: int,
    days_covered: int,
    duty_cycle: float = 1.0,
    direct_kwh: float | None = None,
) -> float:
    """Estimated kWh for an appliance over the days it covers.

    If the user knows the kWh directly, use that.
    Otherwise: watts x hours x uses/day x days x duty cycle / 1000.

    duty_cycle is the fraction of time the appliance actually draws power.
    1.0 = always on while in use (kettle). Lower for cycling appliances (fridge).
    """
    _require_non_negative("days_covered", days_covered)

    if direct_kwh is not None:
        _require_non_negative("direct_kwh", direct_kwh)
        return direct_kwh

    if rated_watts is None:
        raise ValueError("Provide either rated_watts or direct_kwh")

    _require_non_negative("rated_watts", rated_watts)
    _require_non_negative("hours_per_use", hours_per_use)
    _require_non_negative("uses_per_day", uses_per_day)
    if not 0 < duty_cycle <= 1:
        raise ValueError(f"duty_cycle must be greater than 0 and at most 1 (got {duty_cycle})")

    watt_hours = rated_watts * hours_per_use * uses_per_day * days_covered * duty_cycle
    return watt_hours / WATTS_PER_KILOWATT


def kwh_within_range(
    total_kwh: float,
    start_date: date,
    days_covered: int,
    range_start: date,
    range_end: date,
) -> float:
    """How much of a multi-day record falls inside a date range (inclusive).

    A record's kWh is spread evenly over its days. Only the days that overlap
    the range are counted, so the same kWh is never counted twice.
    """
    if days_covered <= 0 or range_end < range_start:
        return 0.0

    record_end = start_date + timedelta(days=days_covered - 1)
    overlap_start = max(start_date, range_start)
    overlap_end = min(record_end, range_end)

    if overlap_end < overlap_start:
        return 0.0

    overlap_days = (overlap_end - overlap_start).days + 1
    return total_kwh / days_covered * overlap_days


# ---------- Costs ----------

def water_cost(litres: float, rate_per_m3: float | None) -> float | None:
    """Estimated water cost in N$. Returns None if no tariff is set."""
    if rate_per_m3 is None:
        return None
    _require_non_negative("litres", litres)
    _require_non_negative("rate_per_m3", rate_per_m3)
    return litres / LITRES_PER_CUBIC_METRE * rate_per_m3


def electricity_cost(kwh: float, rate_per_kwh: float | None) -> float | None:
    """Estimated electricity cost in N$. Returns None if no tariff is set."""
    if rate_per_kwh is None:
        return None
    _require_non_negative("kwh", kwh)
    _require_non_negative("rate_per_kwh", rate_per_kwh)
    return kwh * rate_per_kwh