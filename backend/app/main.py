"""
main.py — FastAPI application entry point.
This file wires everything together: middleware, routers, startup events.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import init_db
from app.routers import auth, sessions, analytics, rag, homework, students
from app.services.redis_service import init_redis, close_redis
from app.services.rag_service import init_rag


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager handles startup and shutdown.

    Startup order matters:
      1. init_db()    — create DB tables (idempotent: CREATE TABLE IF NOT EXISTS)
      2. init_redis() — open the Redis connection pool
      3. init_rag()   — load FAISS index + embedding model into memory

    init_rag() is last because it's the slowest (~3-5s for embedding model load)
    and doesn't block the other services from being ready.

    Shutdown:
      close_redis() — drain in-flight Redis commands and close the TCP connection
    """
    print("Lumio API starting up...")
    await init_db()
    await init_redis()
    await init_rag()
    print("Database, Redis and RAG ready.")
    yield
    await close_redis()
    print("Lumio API shutting down.")


app = FastAPI(
    title="Lumio API",
    description="AI-powered ADHD early detection — IEEE CODE2CURE 2026",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,      prefix="/auth",      tags=["auth"])
app.include_router(sessions.router,  prefix="/sessions",  tags=["sessions"])
app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
app.include_router(rag.router,       prefix="/rag",       tags=["rag"])
app.include_router(homework.router,  prefix="/homework",  tags=["homework"])
app.include_router(students.router,  prefix="/students",  tags=["students"])


@app.get("/", tags=["health"])
async def health_check():
    return {
        "status": "ok",
        "service": "Lumio API",
        "version": "0.1.0",
    }
