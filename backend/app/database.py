"""
database.py — Async SQLAlchemy engine, session factory, and ALL 6 table models.

Tables:
  1. users              — students, teachers, parents
  2. sessions           — study session metadata
  3. focus_events       — per-second focus telemetry (the core data)
  4. homework           — teacher-created assignments
  5. homework_submissions — student submissions + grades
  6. adhd_risk_profiles — nightly ML risk assessments + AI suggestions

On startup, init_db() creates all tables via CREATE TABLE IF NOT EXISTS.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


# ── Engine & Session ──────────────────────────────────────────────────────────
# create_async_engine: manages a pool of database connections.
# pool_size=10: keep 10 connections open and ready.
# max_overflow=20: allow up to 20 extra connections during traffic spikes.
# echo=False: set to True to see all SQL queries in the console (noisy but useful for debugging).
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    echo=False,
)

# async_sessionmaker: factory that creates new database sessions.
# expire_on_commit=False: after committing, objects stay usable without re-querying.
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── Base class ────────────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    """All ORM models inherit from this. It tells SQLAlchemy to track them as tables."""
    pass


# ── Table 1: users ───────────────────────────────────────────────────────────
class User(Base):
    """
    Every person in the system: students, teachers, and parents.
    - role determines what they can see and do.
    - linked_student_id: parents store their child's user ID here.
    - xp_points / streak_days: gamification (Day 10+).
    """
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role = Column(String(20), nullable=False)  # 'student', 'teacher', 'parent'
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    school_id = Column(UUID(as_uuid=True), nullable=True)
    class_id = Column(UUID(as_uuid=True), nullable=True)
    linked_student_id = Column(UUID(as_uuid=True), nullable=True)
    language_pref = Column(String(5), default="en")
    xp_points = Column(Integer, default=0)
    streak_days = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ── Table 2: sessions ────────────────────────────────────────────────────────
class Session(Base):
    """
    A study session: starts when the student opens the focus tracker,
    ends when they close it. Aggregates (avg_focus_score, etc.) are
    computed when the session ends.
    """
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    subject_id = Column(UUID(as_uuid=True), nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)
    duration_sec = Column(Integer, nullable=True)
    avg_focus_score = Column(Float, nullable=True)
    focus_variance = Column(Float, nullable=True)
    distraction_count = Column(Integer, default=0)
    cv_used = Column(Boolean, default=False)


# ── Table 3: focus_events ────────────────────────────────────────────────────
class FocusEvent(Base):
    """
    Per-second focus telemetry from MediaPipe.
    This is the highest-volume table — one row per second per student.

    The composite index on (student_id, ts DESC) is critical for performance:
    the most common query is "get the latest N focus events for student X."
    """
    __tablename__ = "focus_events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    ts = Column(DateTime(timezone=True), server_default=func.now())
    gaze_score = Column(Float, nullable=True)
    blink_rate = Column(Float, nullable=True)
    head_pose_deg = Column(Float, nullable=True)
    focus_score = Column(Float, nullable=True)
    predicted_cause = Column(String(40), nullable=True)
    risk_delta = Column(Float, nullable=True)

    __table_args__ = (
        Index("ix_focus_events_student_ts", "student_id", ts.desc()),
    )


# ── Table 4: homework ────────────────────────────────────────────────────────
class Homework(Base):
    """
    A homework assignment created by a teacher for a class.
    """
    __tablename__ = "homework"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    class_id = Column(UUID(as_uuid=True), nullable=True)
    subject_id = Column(UUID(as_uuid=True), nullable=True)
    title = Column(String(255), nullable=False)
    subject = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    difficulty_level = Column(Integer, default=1)
    attachment_url = Column(String(500), nullable=True)
    # JSON array of student UUID strings; null means assigned to the whole class
    assigned_to = Column(JSON, nullable=True)


# ── Table 5: homework_submissions ────────────────────────────────────────────
class HomeworkSubmission(Base):
    """
    A student's submission for a homework assignment.
    - grade: 0-20 scale (Tunisian grading system)
    - struggle_flag: auto-set when grade < 8 — feeds into the risk profiler
    """
    __tablename__ = "homework_submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    homework_id = Column(UUID(as_uuid=True), ForeignKey("homework.id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    file_url = Column(String(500), nullable=True)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    grade = Column(Float, nullable=True)
    teacher_feedback = Column(Text, nullable=True)
    struggle_flag = Column(Boolean, default=False)
    time_spent_sec = Column(Integer, nullable=True)
    analysis = Column(Text, nullable=True)


# ── Table 6: adhd_risk_profiles ──────────────────────────────────────────────
class ADHDRiskProfile(Base):
    """
    Nightly ML risk assessment for each student.
    - risk_score: TEACHER ONLY — never return to parent API
    - risk_tier: 'low', 'moderate', 'needs_attention'
    - top_signals: feature importances dict from Random Forest
    - suggested_actions: {for_teacher:[], for_student:[], for_parent:[], sources:[], urgency:str}
    - professional_referral: set by rule engine ONLY, never by LLM
    """
    __tablename__ = "adhd_risk_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    computed_at = Column(DateTime(timezone=True), server_default=func.now())
    risk_score = Column(Float, nullable=True)
    risk_tier = Column(String(20), nullable=True)
    top_signals = Column(JSON, nullable=True)
    suggested_actions = Column(JSON, nullable=True)
    professional_referral = Column(Boolean, default=False)
    seen_by_teacher = Column(Boolean, default=False)


# ── Dependency: get_db() ──────────────────────────────────────────────────────
async def get_db():
    """
    FastAPI dependency that provides a database session per request.
    Usage in a router:
        @router.get("/example")
        async def example(db: AsyncSession = Depends(get_db)):
            ...
    The session auto-closes when the request finishes (via the 'finally' block).
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# ── Startup: init_db() ───────────────────────────────────────────────────────
async def init_db():
    """
    Create all tables if they don't exist yet.
    Called once at FastAPI startup via the lifespan context manager in main.py.
    Uses run_sync because CREATE TABLE is a DDL operation that SQLAlchemy
    handles synchronously — we wrap it to work with our async engine.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
