"""AI Resource Coach: asks n8n for advice, falls back to rules if anything goes wrong.

Privacy: only aggregated totals and rankings are sent. No notes, no record IDs,
no names or addresses. Nothing here logs the prompt or the household data.
"""
import logging

import httpx
from pydantic import ValidationError

from ..config import settings
from ..schemas.coach import CoachAIOutput, CoachResponse, Recommendation

log = logging.getLogger("ecotrack.coach")

DATA_NOTE = (
    "These figures are estimates calculated from activities you recorded, "
    "not meter readings. Actual use and bills may differ."
)


def build_ai_payload(question: str, period: str, summary: dict, goals: list[dict]) -> dict:
    """The ONLY data that leaves the app. Aggregates only."""
    return {
        "question": question,
        "period": {"label": period, "start": summary["start"], "end": summary["end"], "days": summary["days"]},
        "data_basis": "estimates from user-recorded activities (not meter readings)",
        "contains_demo_data": summary["contains_demo_data"],
        "water": {
            "total_litres": summary["water"]["total_litres"],
            "daily_average_litres": summary["water"]["daily_average_litres"],
            "top_activities": summary["water"]["by_activity"][:5],
            "change_vs_previous_percent": summary.get("comparison", {}).get("water", {}).get("change_percent"),
        },
        "electricity": {
            "total_kwh": summary["electricity"]["total_kwh"],
            "daily_average_kwh": summary["electricity"]["daily_average_kwh"],
            "top_appliances": [
                {k: a[k] for k in ("category", "kwh", "share", "cost")}
                for a in summary["electricity"]["by_appliance"][:5]
            ],
            "change_vs_previous_percent": summary.get("comparison", {}).get("electricity", {}).get("change_percent"),
        },
        "costs_available": summary["water"]["cost"] is not None or summary["electricity"]["cost"] is not None,
        "rates_are_illustrative": summary["tariffs"]["rates_are_illustrative"],
        "goals": [
            {k: g[k] for k in ("resource", "target_value", "unit", "used", "percent_used", "status")}
            for g in goals
        ],
    }


def ask_coach(question: str, period: str, summary: dict, goals: list[dict]) -> CoachResponse:
    if not settings.coach_ai_configured:
        return _fallback(question, summary, reason="AI coach is not configured")

    payload = build_ai_payload(question, period, summary, goals)
    try:
        response = httpx.post(
            settings.n8n_webhook_url,
            json=payload,
            headers={"X-EcoTrack-Secret": settings.n8n_shared_secret.get_secret_value()},
            timeout=settings.coach_timeout_seconds,
        )
        response.raise_for_status()
        ai = CoachAIOutput.model_validate(response.json())
    except httpx.TimeoutException:
        return _fallback(question, summary, reason="AI service timed out")
    except httpx.HTTPError as exc:
        log.warning("Coach webhook failed: %s", type(exc).__name__)
        return _fallback(question, summary, reason="AI service unavailable")
    except (ValidationError, ValueError):
        log.warning("Coach webhook returned an invalid response")
        return _fallback(question, summary, reason="AI response was not in the expected format")

    return CoachResponse(source="ai", **ai.model_dump())


# ---------------- Rule-based fallback ----------------

WATER_ADVICE = {
    "shower": ("Shorten showers by 2 minutes", "easy",
               "Showers are your largest estimated water use. Every minute cut saves roughly the flow rate of your shower head in litres."),
    "bath": ("Swap some baths for short showers", "easy",
             "A full bath usually uses more water than a short shower."),
    "laundry": ("Run the washing machine with full loads", "easy",
                "Fewer, fuller loads use less water per item washed."),
    "dishes": ("Wash dishes in a basin, not under a running tap", "easy",
               "A filled basin uses a fixed amount of water; a running tap keeps flowing."),
    "gardening": ("Water the garden early morning or evening", "easy",
                  "Less water evaporates when it is cooler, so more reaches the roots."),
    "cleaning": ("Use a bucket instead of a hose for cleaning", "easy",
                 "A bucket limits how much water is used."),
    "handwashing": ("Turn the tap off while lathering", "easy",
                    "The tap does not need to run while you scrub."),
    "other": ("Check for leaks", "moderate",
              "Read your water meter before and after a period with no water use. If it moves, there may be a leak."),
}

POWER_ADVICE = {
    "geyser": ("Put the geyser on a timer", "moderate",
               "Heating water is often a large share of household electricity. Heating only before you need hot water reduces standby heat loss. Ask a qualified electrician to install a timer."),
    "kettle": ("Boil only the water you need", "easy",
               "Boiling a full kettle for one cup heats water you do not use."),
    "fridge": ("Keep the fridge door closed and the seals clean", "easy",
               "Cold air escapes when the door is open and the compressor has to run longer."),
    "heater": ("Heat one room and close the door", "easy",
               "Heating a smaller, closed space needs less energy."),
    "iron": ("Iron clothes in one batch", "easy",
             "The iron uses a lot of power while heating up; one session avoids reheating."),
    "washing_machine": ("Wash on a cold or eco cycle", "easy",
                        "Most of a washing machine's energy goes into heating water."),
    "lighting": ("Switch off lights in empty rooms and use LED bulbs", "easy",
                 "LED bulbs use much less power than incandescent bulbs for the same light."),
    "stove": ("Use lids on pots", "easy",
              "A lid keeps heat in, so food cooks faster on a lower setting."),
    "other": ("Switch appliances off at the wall", "easy",
              "Many appliances draw standby power when they are not in use."),
}


def _focus(question: str) -> set[str]:
    q = question.lower()
    wants_water = any(w in q for w in ("water", "shower", "litre", "tap", "bath", "garden", "laundry"))
    wants_power = any(w in q for w in ("electric", "power", "kwh", "appliance", "energy", "geyser", "kettle"))
    if wants_water and not wants_power:
        return {"water"}
    if wants_power and not wants_water:
        return {"electricity"}
    return {"water", "electricity"}


def _fallback(question: str, summary: dict, reason: str) -> CoachResponse:
    focus = _focus(question)
    water, power = summary["water"], summary["electricity"]
    recs: list[Recommendation] = []
    lines: list[str] = []

    if "water" in focus and water["by_activity"]:
        top = water["by_activity"][0]
        lines.append(
            f"Your largest estimated water use is {top['name']} "
            f"({top['litres']:,.0f} L, {top['share']:.0f}% of {water['total_litres']:,.0f} L recorded)."
        )
        for item in water["by_activity"][:2]:
            title, effort, why = WATER_ADVICE.get(item["name"], WATER_ADVICE["other"])
            recs.append(Recommendation(
                title=title, effort=effort, resource="water",
                why=f"{item['name'].capitalize()} accounts for {item['share']:.0f}% of your estimated water use. {why}",
            ))

    if "electricity" in focus and power["by_appliance"]:
        top = power["by_appliance"][0]
        lines.append(
            f"Your largest estimated electricity use is {top['name']} "
            f"({top['kwh']:,.1f} kWh, {top['share']:.0f}% of {power['total_kwh']:,.1f} kWh recorded)."
        )
        for item in power["by_appliance"][:2]:
            title, effort, why = POWER_ADVICE.get(item["category"], POWER_ADVICE["other"])
            recs.append(Recommendation(
                title=title, effort=effort, resource="electricity",
                why=f"{item['name']} accounts for {item['share']:.0f}% of your estimated electricity use. {why}",
            ))

    if not recs:
        return CoachResponse(
            source="fallback",
            fallback_reason=reason,
            summary="There is not enough recorded data for this period to give specific advice yet.",
            recommendations=[Recommendation(
                title="Log a few days of activities", effort="easy", resource="both",
                why="Record your showers, laundry and main appliances for a few days. The coach can then point to your largest uses.",
            )],
            data_note=DATA_NOTE,
        )

    return CoachResponse(
        source="fallback",
        fallback_reason=reason,
        summary=" ".join(lines) + " These suggestions come from EcoTrack's built-in tips.",
        recommendations=recs[:4],
        data_note=DATA_NOTE,
    )