"""EcoTrack FastAPI application: API routes plus the static frontend."""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from . import models
from .config import FRONTEND_DIR, settings
from .database import Base, SessionLocal, engine
from .routes import coach, dashboard, demo, electricity, goals, health, tips, water
from .routes import settings as settings_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs once when the server starts (before yield) and once when it stops (after)."""
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.get(models.Settings, 1) is None:
            db.add(models.Settings(id=1))
            db.commit()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="EcoTrack API",
    version="1.0.0",
    description=(
        "Household water and electricity estimation API. "
        "All consumption figures are estimates calculated from recorded activities."
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


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Calculation errors (e.g. a negative value that slipped past a schema) become a 422."""
    return JSONResponse(status_code=422, content={"detail": str(exc)})


# API routes first, so they take priority over the frontend files.
for router in (health, water, electricity, settings_routes, dashboard, goals, tips, coach, demo):
    app.include_router(router.router, prefix="/api")

# Serve the frontend at "/". Must stay LAST: it catches every other path.
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")