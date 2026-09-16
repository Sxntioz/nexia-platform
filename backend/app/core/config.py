from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    database_url: str = "sqlite:///./student_project.db"
    frontend_origin: str = "http://localhost:5173"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.7-flash"
    gemini_fallback_model: str = "gemini-3.6-flash"
    max_video_size_mb: int = 5120
    upload_dir: Path = PROJECT_ROOT / "backend" / "data" / "uploads"
    secret_key: str = "nexia-secret-key-development-2026"
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_bucket_name: str | None = None
    aws_region: str = "us-east-2"

    @field_validator("database_url", mode="before")
    @classmethod
    def local_database_when_empty(cls, value):
        return value or "sqlite:///./student_project.db"

    model_config = SettingsConfigDict(
        env_file=(PROJECT_ROOT / ".env", PROJECT_ROOT / "backend" / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
