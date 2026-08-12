from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(ROOT_DIR / ".env", ROOT_DIR / "backend" / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    app_name: str = "Cascadis Data Center Sustainability Scoring API"
    app_version: str = "0.1.0"
    api_prefix: str = "/api/v1"

    db_path: Path = Field(
        default=ROOT_DIR / "backend" / "data" / "dc_cooling.sqlite3",
        validation_alias="DC_COOLING_DB_PATH",
    )
    decision_policy_path: Path = Field(
        default=ROOT_DIR / "config" / "decision_policy.v1.json",
        validation_alias="DECISION_POLICY_PATH",
    )
    google_portfolio_manifest_path: Path = Field(
        default=(
            ROOT_DIR
            / "data"
            / "public_portfolios"
            / "google_public_data_centers.v1.json"
        ),
        validation_alias="GOOGLE_PORTFOLIO_MANIFEST_PATH",
    )

    aqueduct_url: str = Field(
        default=(
            "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/"
            "aqueduct_water_risk/FeatureServer/1/query"
        ),
        validation_alias="AQUEDUCT_ESRI_URL",
    )
    aqueduct_cache_ttl_hours: int = Field(
        default=168,
        ge=1,
        validation_alias="AQUEDUCT_CACHE_TTL_HOURS",
    )
    aqueduct_dataset_vintage: str = "April 2023"

    ember_url: str = Field(
        default="https://api.ember-energy.org/v1/carbon-intensity/yearly",
        validation_alias="EMBER_API_URL",
    )
    ember_public_csv_url: str = Field(
        default=(
            "https://files.ember-energy.org/public-downloads/generation/outputs/"
            "release_generation_yearly_global.csv"
        ),
        validation_alias="EMBER_PUBLIC_CSV_URL",
    )
    ember_api_key: str | None = Field(default=None, validation_alias="EMBER_API_KEY")
    ember_data_year: int = Field(default=2025, ge=2000, le=2100, validation_alias="EMBER_DATA_YEAR")
    grid_cache_ttl_hours: int = Field(
        default=168,
        ge=1,
        validation_alias="GRID_CACHE_TTL_HOURS",
    )

    request_timeout_seconds: float = Field(
        default=12.0,
        gt=0,
        le=60,
        validation_alias="SOURCE_REQUEST_TIMEOUT_SECONDS",
    )
    source_retry_attempts: int = Field(
        default=3,
        ge=1,
        le=5,
        validation_alias="SOURCE_RETRY_ATTEMPTS",
    )
    assessment_concurrency: int = Field(
        default=8,
        ge=1,
        le=20,
        validation_alias="ASSESSMENT_CONCURRENCY",
    )

    allowed_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        validation_alias="ALLOWED_ORIGINS",
    )

    @property
    def allowed_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]
