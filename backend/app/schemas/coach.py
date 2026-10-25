"""AI Resource Coach request and response shapes."""
from typing import Literal

from pydantic import BaseModel, Field


class CoachRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    period: Literal["week", "month"] = "month"


class Recommendation(BaseModel):
    title: str = Field(max_length=120)
    why: str = Field(max_length=600)
    resource: Literal["water", "electricity", "both"]
    effort: Literal["easy", "moderate", "hard"]


class CoachAIOutput(BaseModel):
    """What n8n must return. Anything else is rejected and the fallback is used."""
    summary: str = Field(min_length=1, max_length=1200)
    recommendations: list[Recommendation] = Field(min_length=1, max_length=5)
    data_note: str = Field(max_length=400)


class CoachResponse(CoachAIOutput):
    source: Literal["ai", "fallback"]
    fallback_reason: str | None = None