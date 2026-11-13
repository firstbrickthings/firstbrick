from functools import lru_cache
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    database_url: str = 'mysql+pymysql://babyone:configure-password@localhost:3306/babyone?charset=utf8mb4'
    firebase_service_account_json: str = ''
    firebase_project_id: str = 'baby-one-a5cd4'
    auth_secret: str = ''
    auth_cookie_secure: bool = True
    email_otp_enabled: bool = True
    auth_email_sender: str = 'babyonestores@gmail.com'
    admin_verified_emails: str = ''
    gmail_oauth_client_id: str = ''
    gmail_oauth_client_secret: str = ''
    admin_firebase_uids: str = ''
    admin_verified_phones: str = ''
    allowed_origins: str = 'http://localhost:8000,http://127.0.0.1:8000'
    razorpay_key_id: str = ''
    razorpay_key_secret: str = ''
    razorpay_webhook_secret: str = ''
    razorpay_mode: Literal['test','live'] = 'test'
    razorpay_live_key_id: str = ''
    razorpay_live_key_secret: str = ''
    razorpay_live_webhook_secret: str = ''
    razorpay_prepare_live: bool = False
    razorpay_live_webhook_confirmed: bool = False
    enable_test_checkout: bool = False
    catalog_stock_five_once: bool = False
    catalog_price_ten_once: bool = False
    catalog_publish_prices_once: bool = False
    shipping_flat_99_once: bool = False
    media_endpoint: str = ''
    media_bucket: str = ''
    media_region: str = 'auto'
    media_access_key: str = ''
    media_secret_key: str = ''
    sheets_url: str = ''
    sheets_secret: str = ''
    sheets_enabled: bool = False
    public_store_url: str = 'https://babyone-web-test.up.railway.app'
    cart_link_secret: str = ''
    whatsapp_enabled: bool = False
    whatsapp_access_token: str = ''
    whatsapp_phone_number_id: str = ''
    whatsapp_waba_id: str = ''
    whatsapp_app_secret: str = ''
    whatsapp_verify_token: str = ''
    whatsapp_graph_version: str = ''
    whatsapp_language: str = 'en_US'
    whatsapp_cart_template: str = 'babyone_cart_reminder'
    whatsapp_order_template: str = 'babyone_order_update'
    database_pool_size: int = Field(default=5, ge=1, le=50)

    @property
    def admins(self) -> set[str]:
        return {value.strip() for value in self.admin_firebase_uids.split(',') if value.strip()}

    @property
    def admin_emails(self) -> set[str]:
        return {value.strip().lower() for value in self.admin_verified_emails.split(',') if value.strip()}

    @property
    def admin_phones(self) -> set[str]:
        return {phone for value in self.admin_verified_phones.split(',')
                if (phone := value.strip()).startswith('+91') and len(phone) == 13 and phone[1:].isdigit()}

    @property
    def origins(self) -> list[str]:
        return [value.strip() for value in self.allowed_origins.split(',') if value.strip()]

    @property
    def test_checkout_enabled(self) -> bool:
        return (self.razorpay_mode == 'test' and self.enable_test_checkout and self.razorpay_key_id.startswith('rzp_test_')
                and bool(self.razorpay_key_secret))

    def payment_keys(self, mode=None):
        return (self.razorpay_live_key_id,self.razorpay_live_key_secret) if (mode or self.razorpay_mode)=='live' else (self.razorpay_key_id,self.razorpay_key_secret)

    def payment_keys_configured(self, mode=None):
        mode=mode or self.razorpay_mode
        key,secret=self.payment_keys(mode)
        return mode in {'test','live'} and key.startswith('rzp_'+mode+'_') and len(key)<=80 and bool(secret) and not any(c.isspace() for c in key+secret)


@lru_cache
def settings() -> Settings:
    return Settings()
