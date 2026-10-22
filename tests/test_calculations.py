"""Tests for the pure calculation functions."""
from datetime import date

import pytest

from app.services.calculations import (
    electricity_cost,
    electricity_kwh,
    kwh_within_range,
    water_cost,
    water_litres,
)


# ---------- Water ----------

def test_shower_uses_flow_rate_times_duration():
    # 9 L/min for 10 minutes, once
    assert water_litres(flow_rate_lpm=9, duration_min=10) == 90


def test_occurrences_multiply_the_result():
    # Two 5-minute showers at 9 L/min
    assert water_litres(flow_rate_lpm=9, duration_min=5, occurrences=2) == 90


def test_direct_litres_takes_priority():
    # A 10 L bucket used 3 times; flow rate is ignored
    assert water_litres(flow_rate_lpm=9, duration_min=10, occurrences=3, direct_litres=10) == 30


def test_zero_duration_gives_zero():
    assert water_litres(flow_rate_lpm=9, duration_min=0) == 0


def test_negative_duration_is_rejected():
    with pytest.raises(ValueError):
        water_litres(flow_rate_lpm=9, duration_min=-5)


def test_missing_inputs_are_rejected():
    with pytest.raises(ValueError):
        water_litres(flow_rate_lpm=None, duration_min=10)


# ---------- Electricity ----------

def test_kettle_energy():
    # 2000 W kettle, 3 minutes (0.05 h), 4 times a day, for 7 days
    # 2000 x 0.05 x 4 x 7 = 2800 Wh = 2.8 kWh
    assert electricity_kwh(2000, 0.05, 4, 7) == pytest.approx(2.8)


def test_duty_cycle_reduces_fridge_estimate():
    # 150 W fridge, 24 h, 30 days, compressor runs 40% of the time
    full = electricity_kwh(150, 24, 1, 30)
    cycled = electricity_kwh(150, 24, 1, 30, duty_cycle=0.4)
    assert full == pytest.approx(108)
    assert cycled == pytest.approx(43.2)


def test_missing_watts_without_direct_kwh_is_rejected():
    with pytest.raises(ValueError):
        electricity_kwh(None, 1, 1, 1)


def test_direct_kwh_used_when_watts_unknown():
    assert electricity_kwh(None, 0, 0, 30, direct_kwh=35) == 35


def test_invalid_duty_cycle_is_rejected():
    with pytest.raises(ValueError):
        electricity_kwh(150, 24, 1, 30, duty_cycle=1.5)


# ---------- No double counting ----------

def test_record_fully_inside_range_counts_once():
    # 30 kWh spread over 1-30 Oct; range covers all of it
    assert kwh_within_range(30, date(2026, 10, 1), 30, date(2026, 10, 1), date(2026, 10, 31)) == 30


def test_only_overlapping_days_are_counted():
    # 30 kWh over 30 days = 1 kWh/day. A 7-day week inside it gets 7 kWh.
    assert kwh_within_range(30, date(2026, 10, 1), 30, date(2026, 10, 5), date(2026, 10, 11)) == pytest.approx(7)


def test_adjacent_weeks_add_up_to_the_total():
    # Splitting the period into pieces must not create or lose energy.
    start = date(2026, 10, 1)
    first_half = kwh_within_range(30, start, 30, date(2026, 10, 1), date(2026, 10, 15))
    second_half = kwh_within_range(30, start, 30, date(2026, 10, 16), date(2026, 10, 30))
    assert first_half + second_half == pytest.approx(30)


def test_record_outside_range_counts_zero():
    assert kwh_within_range(30, date(2026, 9, 1), 30, date(2026, 10, 1), date(2026, 10, 31)) == 0


# ---------- Costs ----------

def test_water_cost_converts_litres_to_cubic_metres():
    # 2500 L = 2.5 m3, at an illustrative N$30 per m3
    assert water_cost(2500, 30) == pytest.approx(75)


def test_no_tariff_means_no_cost():
    assert water_cost(2500, None) is None
    assert electricity_cost(100, None) is None


def test_negative_tariff_is_rejected():
    with pytest.raises(ValueError):
        electricity_cost(100, -2)

def test_electricity_cost_multiplies_kwh_by_rate():
    # 150 kWh at an illustrative N$2.50 per kWh = N$375
    assert electricity_cost(150, 2.50) == pytest.approx(375)        