from  pydantic_settings import BaseSettings , SettingsConfigDict 
from typing import List
from pathlib import Path 
from pydantic import BaseModel

BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent


class DatabaseSettings(BaseModel):
    DATABASE_HOST: str
    DATABASE_USER: str
    DATABASE_PASSWORD: str
    DATABASE_NAME: str
    DATABASE_PORT: int = 5432
    DATABASE_SSL: str = "disable"

    FIRST_SUPERUSER_USERNAME: str = "superadmin"
    FIRST_SUPERUSER_PASSWORD: str
    FIRST_SUPERUSER_PHONE: str

    @property
    def url(self) -> str:
        return f"postgresql+asyncpg://{self.DATABASE_USER}:{self.DATABASE_PASSWORD}@{self.DATABASE_HOST}:{self.DATABASE_PORT}/{self.DATABASE_NAME}?ssl={self.DATABASE_SSL}"

class JWTSettings(BaseModel):

    SECRET_KEY:str
    algorithm:str = "HS256"
    

class Settings(BaseSettings):
    app_name: str = "WMS-Light"
    debug: bool = False
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]
    static_dir: Path =  BASE_DIR / "frontend"

    db: DatabaseSettings
    jwt:JWTSettings

    model_config = SettingsConfigDict(env_file=".env", env_nested_delimiter="__")


settings = Settings()