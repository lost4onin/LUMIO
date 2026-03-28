"""
seed_demo.py — Insert demo data for jury presentation.

Creates:
  - 1 teacher:  teacher@demo.com / demo1234
  - 3 students: Yassine (needs_attention), Mohamed (moderate), Sarra (low)
  - 1 parent:   parent@demo.com / demo1234, linked to Yassine
  - 420 focus events for Yassine (7 days × 60 events, cause='fatigue')
  - 2 homework assignments
  - 1 submission: Yassine, grade=4.0, struggle_flag=True
  - 3 adhd_risk_profiles with pre-built suggested_actions

Run inside Docker:
  docker exec -it lumio-api python scripts/seed_demo.py

Or from host (if port 5432 is exposed):
  DATABASE_URL=postgresql+asyncpg://lumio:localdev@localhost:5432/lumio python scripts/seed_demo.py
"""
import asyncio
import os
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta
from uuid import uuid4

# Make app.* importable when running as a script
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select, delete
from passlib.context import CryptContext

from app.database import Base, User, Session as StudySession, FocusEvent, Homework, HomeworkSubmission, ADHDRiskProfile

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://lumio:localdev@localhost:5432/lumio",
)

YASSINE_SUGGESTED_ACTIONS = {
    "summary": "Student shows persistent fatigue and low focus — structured support and rest strategies recommended.",
    "for_teacher": [
        "Break tasks into 10-minute focused blocks with short breaks between each.",
        "Seat the student away from windows and high-traffic areas.",
        "Check in privately at the start of each lesson to gauge energy level.",
    ],
    "for_student": [
        "Drink a glass of water before studying — dehydration reduces focus.",
        "Try the Pomodoro technique: 20 minutes of work, then a 5-minute break.",
    ],
    "for_parent": [
        "Ensure your child gets 8–9 hours of sleep on school nights.",
        "Ask about their day after school — a brief chat reduces stress before homework.",
    ],
    "sources": ["fatigue_learning_support.pdf", "classroom_strategies.pdf"],
    "urgency": "high",
    "professional_referral": False,
}

MOHAMED_SUGGESTED_ACTIONS = {
    "summary": "Student shows moderate attention difficulties — content scaffolding recommended.",
    "for_teacher": [
        "Provide worked examples before assigning independent tasks.",
        "Use visual aids alongside verbal instructions.",
    ],
    "for_student": [
        "Write down the goal of each study session before you start.",
        "Use a checklist to track completed tasks.",
    ],
    "for_parent": [
        "Create a consistent homework routine at the same time each day.",
        "Praise effort, not just results.",
    ],
    "sources": ["content_difficulty_support.pdf"],
    "urgency": "medium",
    "professional_referral": False,
}

SARRA_SUGGESTED_ACTIONS = {
    "summary": "Student is performing well — continue current strategies.",
    "for_teacher": [
        "Maintain the current engaging lesson format.",
        "Offer extension tasks to keep the student challenged.",
    ],
    "for_student": [
        "Keep up the good work — your focus score is strong.",
        "Help a classmate who is struggling — teaching reinforces your own learning.",
    ],
    "for_parent": [
        "Your child is doing well — continue the current home study routine.",
    ],
    "sources": [],
    "urgency": "low",
    "professional_referral": False,
}


async def clear_existing_demo_data(db: AsyncSession):
    """Remove any previously seeded demo accounts to allow re-running the script."""
    demo_emails = [
        "teacher@demo.com",
        "yassine@demo.com",
        "mohamed@demo.com",
        "sarra@demo.com",
        "parent@demo.com",
    ]
    for email in demo_emails:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            await db.execute(delete(FocusEvent).where(FocusEvent.student_id == user.id))
            await db.execute(delete(HomeworkSubmission).where(HomeworkSubmission.student_id == user.id))
            await db.execute(delete(ADHDRiskProfile).where(ADHDRiskProfile.student_id == user.id))
            await db.execute(delete(StudySession).where(StudySession.student_id == user.id))
    await db.commit()

    # Remove homework created by the demo teacher
    result = await db.execute(select(User).where(User.email == "teacher@demo.com"))
    teacher = result.scalar_one_or_none()
    if teacher:
        await db.execute(delete(Homework).where(Homework.teacher_id == teacher.id))
        await db.execute(delete(User).where(User.email.in_(demo_emails)))
    await db.commit()


async def seed():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with SessionLocal() as db:
        await clear_existing_demo_data(db)

        hashed = pwd_context.hash("demo1234")
        now = datetime.now(timezone.utc)

        # ── Teacher ───────────────────────────────────────────────────────────
        teacher = User(
            id=uuid4(), role="teacher", full_name="Mr. Karim Belhaj",
            email="teacher@demo.com", hashed_password=hashed,
        )
        db.add(teacher)
        await db.flush()
        print(f"Created teacher: {teacher.email}")

        # ── Students ──────────────────────────────────────────────────────────
        yassine = User(
            id=uuid4(), role="student", full_name="Yassine Trabelsi",
            email="yassine@demo.com", hashed_password=hashed,
            streak_days=8,
        )
        mohamed = User(
            id=uuid4(), role="student", full_name="Mohamed Gharbi",
            email="mohamed@demo.com", hashed_password=hashed,
            streak_days=3,
        )
        sarra = User(
            id=uuid4(), role="student", full_name="Sarra Ben Amor",
            email="sarra@demo.com", hashed_password=hashed,
            streak_days=0,
        )
        db.add_all([yassine, mohamed, sarra])
        await db.flush()
        print(f"Created student: {yassine.full_name} (needs_attention)")
        print(f"Created student: {mohamed.full_name} (moderate)")
        print(f"Created student: {sarra.full_name} (low)")

        # ── Parent linked to Yassine ──────────────────────────────────────────
        parent = User(
            id=uuid4(), role="parent", full_name="Kamel Trabelsi",
            email="parent@demo.com", hashed_password=hashed,
            linked_student_id=yassine.id,
        )
        db.add(parent)
        await db.flush()
        print(f"Created parent: {parent.email} linked to {yassine.full_name}")

        # ── Study sessions for Yassine (one per day, 7 days) ──────────────────
        sessions = []
        for day_offset in range(7):
            session_start = now - timedelta(days=6 - day_offset, hours=2)
            session_end = session_start + timedelta(hours=1, minutes=30)
            s = StudySession(
                id=uuid4(),
                student_id=yassine.id,
                started_at=session_start,
                ended_at=session_end,
                duration_sec=5400,
                avg_focus_score=0.25,
                distraction_count=12,
                cv_used=True,
            )
            sessions.append(s)
        db.add_all(sessions)
        await db.flush()

        # ── 60 focus events per session = 420 total for Yassine ──────────────
        focus_events = []
        for idx, s in enumerate(sessions):
            for second in range(60):
                ts = s.started_at + timedelta(seconds=second * 54)
                fe = FocusEvent(
                    session_id=s.id,
                    student_id=yassine.id,
                    ts=ts,
                    gaze_score=0.2 + (second % 5) * 0.02,
                    blink_rate=18.0 + (second % 3),
                    head_pose_deg=-5.0 + (second % 10),
                    focus_score=0.25,
                    predicted_cause="fatigue",
                    risk_delta=0.01,
                )
                focus_events.append(fe)
        db.add_all(focus_events)
        print(f"Seeded {len(focus_events)} focus events for {yassine.full_name}")

        # ── Homework assignments ──────────────────────────────────────────────
        hw1 = Homework(
            id=uuid4(),
            teacher_id=teacher.id,
            title="Maths — Algebra Chapter 3",
            description="Exercises 1 to 15 from the textbook.",
            due_date=now + timedelta(days=3),
            difficulty_level=2,
        )
        hw2 = Homework(
            id=uuid4(),
            teacher_id=teacher.id,
            title="Sciences — Cell Biology Summary",
            description="Write a one-page summary of cell division.",
            due_date=now + timedelta(days=5),
            difficulty_level=1,
        )
        db.add_all([hw1, hw2])
        await db.flush()
        print("Created 2 homework assignments")

        # ── Yassine submission with struggle_flag=True ────────────────────────
        submission = HomeworkSubmission(
            id=uuid4(),
            homework_id=hw1.id,
            student_id=yassine.id,
            submitted_at=now - timedelta(days=1),
            grade=4.0,
            teacher_feedback="Please review Chapter 3 again and redo exercises 8-12.",
            struggle_flag=True,
            time_spent_sec=3600,
        )
        db.add(submission)
        print("Created 1 submission (struggle_flag=True, grade=4.0/20)")

        # ── Risk profiles ─────────────────────────────────────────────────────
        profiles = [
            ADHDRiskProfile(
                id=uuid4(),
                student_id=yassine.id,
                computed_at=now - timedelta(hours=1),
                risk_score=0.78,
                risk_tier="needs_attention",
                suggested_actions=YASSINE_SUGGESTED_ACTIONS,
                professional_referral=False,
                seen_by_teacher=False,
            ),
            ADHDRiskProfile(
                id=uuid4(),
                student_id=mohamed.id,
                computed_at=now - timedelta(hours=1),
                risk_score=0.45,
                risk_tier="moderate",
                suggested_actions=MOHAMED_SUGGESTED_ACTIONS,
                professional_referral=False,
                seen_by_teacher=False,
            ),
            ADHDRiskProfile(
                id=uuid4(),
                student_id=sarra.id,
                computed_at=now - timedelta(hours=1),
                risk_score=0.12,
                risk_tier="low",
                suggested_actions=SARRA_SUGGESTED_ACTIONS,
                professional_referral=False,
                seen_by_teacher=False,
            ),
        ]
        db.add_all(profiles)
        await db.commit()

        print("\nDemo data ready.")
        print(f"  Yassine ID: {yassine.id}")
        print(f"  Mohamed ID: {mohamed.id}")
        print(f"  Sarra ID:   {sarra.id}")
        print(f"  Teacher ID: {teacher.id}")
        print("\nLogin credentials: teacher@demo.com / demo1234")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
