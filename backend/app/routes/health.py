"""Health check: confirms the API is running and reports which coach mode is active."""
from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from ..config import settings

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str
    coach_mode: str  # "ai" when n8n is configured, otherwise "fallback"
    server_time: datetime


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version="0.1.0",
        environment=settings.app_env,
        coach_mode="ai" if settings.coach_ai_configured else "fallback",
        server_time=datetime.now(timezone.utc),
    )