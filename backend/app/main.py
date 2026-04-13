"""
main.py — FastAPI application entry point.
Wires middleware, routers, and startup events together.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import auth, sessions, analytics, rag, homework, students, classes, parent
from app.services.redis_service import init_redis, close_redis


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Lumio API starting up...")
    await init_db()
    await init_redis()
    print("Database and Redis ready.")
    yield
    await close_redis()
    print("Lumio API shutting down.")


app = FastAPI(
    title="Lumio API",
    description="AI-powered ADHD early detection — IEEE CODE2CURE 2026",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,   # Required for httpOnly cookie auth
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,      prefix="/auth",      tags=["Auth"])
app.include_router(sessions.router,  prefix="/sessions",  tags=["Sessions"])
# WebSocket endpoints mounted at root so frontend can reach /ws/focus/{id}
# and /ws/class/{id} directly (matches useFocusStream / useClassStream).
app.include_router(sessions.ws_router)
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
app.include_router(rag.router,       prefix="/rag",       tags=["RAG"])
app.include_router(homework.router,  prefix="/homework",  tags=["Homework"])
app.include_router(students.router,  prefix="/students",  tags=["Students"])
app.include_router(classes.router,   prefix="/classes",   tags=["Classes"])
app.include_router(parent.router,    prefix="/parent",    tags=["Parent"])


@app.get("/", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "Lumio API", "version": "1.0.0"}
