from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    database_url: str = 'mysql+pymysql://babyone:configure-password@localhost:3306/babyone?charset=utf8mb4'
    firebase_service_account_json: str = ''
    firebase_project_id: str = 'baby-one-a5cd4'
    admin_firebase_uids: str = ''
    admin_verified_phones: str = ''
    allowed_origins: str = 'http://localhost:8000,http://127.0.0.1:8000'
    razorpay_key_id: str = ''
    razorpay_key_secret: str = ''
    razorpay_webhook_secret: str = ''
    enable_test_checkout: bool = False
    database_pool_size: int = Field(default=5, ge=1, le=50)

    @property
    def admins(self) -> set[str]:
        return {value.strip() for value in self.admin_firebase_uids.split(',') if value.strip()}

    @property
    def admin_phones(self) -> set[str]:
        return {phone for value in self.admin_verified_phones.split(',')
                if (phone := value.strip()).startswith('+91') and len(phone) == 13 and phone[1:].isdigit()}

    @property
    def origins(self) -> list[str]:
        return [value.strip() for value in self.allowed_origins.split(',') if value.strip()]

    @property
    def test_checkout_enabled(self) -> bool:
        return (self.enable_test_checkout and self.razorpay_key_id.startswith('rzp_test_')
                and bool(self.razorpay_key_secret))


@lru_cache
def settings() -> Settings:
    return Settings()
