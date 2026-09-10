from pathlib import Path
from pydantic import BaseModel


class Settings(BaseModel):
    PROJECT_NAME: str = "FAST API"
    API_PREFIX: str = ""
    
    # Path to database.db inside backend directory
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent
    DATABASE_PATH: Path = BASE_DIR / "database.db"
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        # SQLite URL with forward slashes for cross-platform compatibility
        return f"sqlite:///{self.DATABASE_PATH.as_posix()}"
    
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


settings = Settings()
