"""Database connection: one engine, shared by the whole app."""
from sqlalchemy import create_engine

from .config import settings
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = settings.resolved_database_url

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)


# A factory: calling SessionLocal() opens a new session (one "phone call").
SessionLocal = sessionmaker(bind=engine, autoflush=False)

class Base(DeclarativeBase):
    """Parent class for every table. It keeps a register of all models."""


def get_db():
    """Give one request its own session, and always close it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()