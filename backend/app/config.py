"""
config.py — All settings loaded from environment variables via pydantic-settings.
Add a variable here first, then use it via: from app.config import settings
"""
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List


class Settings(BaseSettings):
    # ── Database ──────────────────────────────────────────
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://lumio:localdev@postgres:5432/lumio"
    )

    # ── Redis ─────────────────────────────────────────────
    REDIS_URL: str = Field(default="redis://redis:6379")

    # ── JWT ───────────────────────────────────────────────
    JWT_SECRET_KEY: str = Field(default="change-me-min-32-chars")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 15

    # ── Ollama (local dev) ────────────────────────────────
    OLLAMA_BASE_URL: str = Field(default="http://host.docker.internal:11434")
    OLLAMA_MODEL: str = Field(default="mistral:7b")
    OLLAMA_EMBED_MODEL: str = Field(default="nomic-embed-text")

    # ── Groq (cloud production fallback) ──────────────────
    # Free tier at console.groq.com — no credit card needed
    # Swap ChatOllama for ChatGroq in rag_service.py when deploying to Railway
    GROQ_API_KEY: str = Field(default="")
    GROQ_MODEL: str = Field(default="llama3-70b-8192")

    # ── LLM mode ──────────────────────────────────────────
    # Set to "groq" to use the cloud LLM (recommended), "ollama" for local dev
    LLM_PROVIDER: str = Field(default="groq")

    # ── n8n ───────────────────────────────────────────────
    N8N_BASE_URL: str = Field(default="http://n8n:5678")

    # ── CORS ──────────────────────────────────────────────
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:5173", "http://localhost:3000"]
    )

    # ── Supabase ──────────────────────────────────────────
    SUPABASE_URL: str = Field(default="https://xtyrnwsgacdzdormernq.supabase.co")
    SUPABASE_ANON_KEY: str = Field(default="")

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
