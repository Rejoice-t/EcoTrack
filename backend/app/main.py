"""EcoTrack FastAPI application: API routes plus the static frontend."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import FRONTEND_DIR, settings
from .routes import health

app = FastAPI(
    title="EcoTrack API",
    version="0.1.0",
    description=(
        "Household water and electricity estimation API. "
        "All consumption figures are estimates unless marked as meter readings."
    ),
)

# Same-origin by default, so CORS is only switched on if ALLOWED_ORIGINS is set.
if settings.origins_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins_list,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type"],
    )

# API routes first, so they take priority over the frontend files.
app.include_router(health.router, prefix="/api")

# Serve the frontend at "/". Must stay LAST: it catches every other path.
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")