from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    database_url: str = 'mysql+pymysql://babyone:configure-password@localhost:3306/babyone?charset=utf8mb4'
    firebase_project_id: str = 'baby-one-a5cd4'
    admin_firebase_uids: str = ''
    allowed_origins: str = 'http://localhost:8000,http://127.0.0.1:8000'
    database_pool_size: int = Field(default=5, ge=1, le=50)

    @property
    def admins(self) -> set[str]:
        return {value.strip() for value in self.admin_firebase_uids.split(',') if value.strip()}

    @property
    def origins(self) -> list[str]:
        return [value.strip() for value in self.allowed_origins.split(',') if value.strip()]


@lru_cache
def settings() -> Settings:
    return Settings()
