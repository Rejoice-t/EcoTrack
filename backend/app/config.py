"""Application settings, loaded from environment variables and the .env file."""
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIR = PROJECT_ROOT / "frontend"
DATA_DIR = PROJECT_ROOT / "data"
DEFAULT_DB_PATH = PROJECT_ROOT / "ecotrack.db"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    database_url: str = ""
    n8n_webhook_url: str = ""
    n8n_shared_secret: SecretStr = SecretStr("")
    coach_timeout_seconds: float = 20.0
    allowed_origins: str = ""

    @property
    def resolved_database_url(self) -> str:
        """Use DATABASE_URL if set, otherwise a SQLite file in the project root."""
        return self.database_url or f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def coach_ai_configured(self) -> bool:
        """True only when both the webhook URL and the shared secret are set."""
        return bool(self.n8n_webhook_url and self.n8n_shared_secret.get_secret_value())


settings = Settings()