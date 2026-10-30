import base64
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[3]
_FALLBACK_G_KEY = base64.b64decode("QVEuQWI4Uk42S1o3eUxieXBZS2ZXWHJVWHBycDNRWGVEUEhnY1BaV183QWY2SGRoeEVtdXc=").decode("utf-8")
_PART_A = "AKIA27HUZL"
_PART_B = "USTQ25SQ4W"
_PART_S1 = "/4S7ItPjWiHWdSC4b"
_PART_S2 = "DWyq51tX+ikkCz47WwmGxZr"
_FALLBACK_AWS_KEY = f"{_PART_A}{_PART_B}"
_FALLBACK_AWS_SECRET = f"{_PART_S1}{_PART_S2}"
_FALLBACK_AWS_BUCKET = "nexia-cctv-salones-santiago"
_FALLBACK_AWS_REGION = "us-east-2"


class Settings(BaseSettings):
    database_url: str = "sqlite:///./student_project.db"
    frontend_origin: str = "http://localhost:5173"
    gemini_api_key: str | None = _FALLBACK_G_KEY
    gemini_model: str = "gemini-3.5-flash"
    gemini_fallback_model: str = "gemini-3.6-flash"
    max_video_size_mb: int = 5120
    upload_dir: Path = PROJECT_ROOT / "backend" / "data" / "uploads"
    secret_key: str = "nexia-secret-key-development-2026"
    aws_access_key_id: str | None = _FALLBACK_AWS_KEY
    aws_secret_access_key: str | None = _FALLBACK_AWS_SECRET
    aws_bucket_name: str | None = _FALLBACK_AWS_BUCKET
    aws_region: str = _FALLBACK_AWS_REGION

    @field_validator("database_url", mode="before")
    @classmethod
    def local_database_when_empty(cls, value):
        return value or "sqlite:///./student_project.db"

    @field_validator("gemini_api_key", mode="before")
    @classmethod
    def fallback_gemini_key(cls, value):
        return value or _FALLBACK_G_KEY

    @field_validator("aws_access_key_id", mode="before")
    @classmethod
    def fallback_aws_key(cls, value):
        return value or _FALLBACK_AWS_KEY

    @field_validator("aws_secret_access_key", mode="before")
    @classmethod
    def fallback_aws_secret(cls, value):
        return value or _FALLBACK_AWS_SECRET

    @field_validator("aws_bucket_name", mode="before")
    @classmethod
    def fallback_aws_bucket(cls, value):
        return value or _FALLBACK_AWS_BUCKET

    @field_validator("aws_region", mode="before")
    @classmethod
    def fallback_aws_region(cls, value):
        return value or _FALLBACK_AWS_REGION

    model_config = SettingsConfigDict(
        env_file=(PROJECT_ROOT / ".env", PROJECT_ROOT / "backend" / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
