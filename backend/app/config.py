from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    upload_dir: Path = Path(__file__).resolve().parent.parent / "uploads"
    allowed_extensions: set[str] = {"mp4", "mov", "webm", "avi"}
    cors_origins: list[str] = ["http://localhost:3000"]

    hf_token: str = ""
    tribe_model_id: str = "facebook/tribev2"
    hemodynamic_delay_seconds: int = 5

    model_config = {"env_prefix": "NEUROSCORE_"}


settings = Settings()
