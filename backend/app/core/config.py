from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    
    # Clerk
    CLERK_SECRET_KEY: str
    
    # Encryption
    ENCRYPTION_KEY: str
    
    # AWS (optional - can use IAM roles)
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    
    # API
    API_V1_STR: str = "/api"
    PROJECT_NAME: str = "Snowloader"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

