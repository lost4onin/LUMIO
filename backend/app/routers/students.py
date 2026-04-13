"""
students.py — Student profile, progress, and recommendation endpoints.

GET  /students/me/profile              — current student's own profile
GET  /students/{student_id}/profile    — parent/teacher overview
GET  /students/{student_id}/progress   — student's progress page data
POST /students/{student_id}/recommend  — trigger recommender pipeline

Access rules:
  - teacher: full profile including risk_score
  - parent:  only their linked child, risk_score NEVER returned
  - student: only their own profile/progress
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import (
    ADHDRiskProfile,
    FocusEvent,
    Homework,
    HomeworkSubmission,
    Session as SessionModel,
    User,
    get_db,
)
from app.routers.auth import get_current_user
from app.services.recommender import generate_suggestions

router = APIRouter()


def _try_uuid(value: str) -> Optional[UUID]:
    try:
        return UUID(value)
    except (ValueError, AttributeError, TypeError):
        return None


async def _focus_avg_7d(db: AsyncSession, student_id: UUID) -> float:
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    result = await db.execute(
        select(func.avg(FocusEvent.focus_score)).where(
            FocusEvent.student_id == student_id,
            FocusEvent.ts >= seven_days_ago,
        )
    )
    value = result.scalar()
    return round(float(value), 3) if value is not None else 0.0


async def _focus_history_7d(db: AsyncSession, student_id: UUID) -> list:
    """Per-day average focus for the last 7 days."""
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    result = await db.execute(
        select(
            func.date(FocusEvent.ts).label("day"),
            func.avg(FocusEvent.focus_score).label("avg_focus"),
        )
        .where(
            FocusEvent.student_id == student_id,
            FocusEvent.ts >= seven_days_ago,
        )
        .group_by(func.date(FocusEvent.ts))
        .order_by(func.date(FocusEvent.ts))
    )
    return [
        {"date": row.day.isoformat() if row.day else "", "avg_focus": round(float(row.avg_focus or 0.0), 3)}
        for row in result.all()
    ]


@router.get("/me/profile", tags=["Students"])
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Students only")

    result = await db.execute(
        select(ADHDRiskProfile)
        .where(ADHDRiskProfile.student_id == current_user.id)
        .order_by(ADHDRiskProfile.computed_at.desc())
        .limit(1)
    )
    profile = result.scalar_one_or_none()
    focus_avg = await _focus_avg_7d(db, current_user.id)

    return {
        "student_id": str(current_user.id),
        "name": current_user.full_name,
        "risk_tier": profile.risk_tier if profile else "low",
        "for_student": (profile.suggested_actions or {}).get("for_student", []) if profile else [],
        "focus_avg_7d": focus_avg,
        "professional_referral": profile.professional_referral if profile else False,
    }


@router.get("/{student_id}/profile", tags=["Students"])
async def get_student_profile(
    student_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unified profile shape for parent overview + teacher dashboard.

    Returns: {name, risk_tier, for_student, for_parent, focus_avg_7d,
              focus_history, homework}
    """
    student_uuid = _try_uuid(student_id)
    if student_uuid is None:
        raise HTTPException(status_code=404, detail="Student not found")

    # Role-based access control
    if current_user.role == "student" and str(current_user.id) != student_id:
        raise HTTPException(status_code=403, detail="Students can only view their own profile")
    if current_user.role == "parent" and str(current_user.linked_student_id) != student_id:
        raise HTTPException(status_code=403, detail="Parents can only view their linked child's profile")

    student_result = await db.execute(select(User).where(User.id == student_uuid))
    student = student_result.scalar_one_or_none()
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")

    profile_result = await db.execute(
        select(ADHDRiskProfile)
        .where(ADHDRiskProfile.student_id == student_uuid)
        .order_by(ADHDRiskProfile.computed_at.desc())
        .limit(1)
    )
    profile = profile_result.scalar_one_or_none()

    suggestions = (profile.suggested_actions or {}) if profile else {}

    # Homework list — for each assignment, compute this student's status
    hw_result = await db.execute(
        select(Homework, HomeworkSubmission)
        .join(
            HomeworkSubmission,
            (HomeworkSubmission.homework_id == Homework.id)
            & (HomeworkSubmission.student_id == student_uuid),
            isouter=True,
        )
        .order_by(Homework.due_date.desc())
        .limit(20)
    )
    now = datetime.now(timezone.utc)
    homework = []
    for hw, sub in hw_result.all():
        if sub is not None:
            status = "graded" if sub.grade is not None else "submitted"
        elif hw.due_date and hw.due_date < now:
            status = "pending"
        else:
            status = "pending"
        homework.append({"title": hw.title, "status": status})

    data = {
        "name": student.full_name,
        "risk_tier": (profile.risk_tier if profile else None) or "low",
        "for_student": suggestions.get("for_student", []),
        "for_parent": suggestions.get("for_parent", []),
        "focus_avg_7d": await _focus_avg_7d(db, student_uuid),
        "focus_history": await _focus_history_7d(db, student_uuid),
        "homework": homework,
    }

    if current_user.role == "teacher" and profile is not None:
        data["risk_score"] = profile.risk_score
        data["professional_referral"] = profile.professional_referral
        data["seen_by_teacher"] = profile.seen_by_teacher

    return data


@router.get("/{student_id}/progress", tags=["Students"])
async def get_student_progress(
    student_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Data for the student progress page."""
    student_uuid = _try_uuid(student_id)
    if student_uuid is None:
        raise HTTPException(status_code=404, detail="Student not found")

    # Access: students see only themselves; parents only their linked child
    if current_user.role == "student" and str(current_user.id) != student_id:
        raise HTTPException(status_code=403, detail="Students can only view their own progress")
    if current_user.role == "parent" and str(current_user.linked_student_id) != student_id:
        raise HTTPException(status_code=403, detail="Parents can only view their linked child's progress")

    student_result = await db.execute(select(User).where(User.id == student_uuid))
    student = student_result.scalar_one_or_none()
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")

    # Session aggregates
    agg_result = await db.execute(
        select(
            func.count(SessionModel.id),
            func.coalesce(func.sum(SessionModel.duration_sec), 0),
        ).where(SessionModel.student_id == student_uuid)
    )
    total_sessions, total_duration_sec = agg_result.one()

    # Recent sessions (top 10)
    recent_result = await db.execute(
        select(SessionModel)
        .where(SessionModel.student_id == student_uuid)
        .order_by(SessionModel.started_at.desc())
        .limit(10)
    )
    recent_sessions = []
    for s in recent_result.scalars().all():
        recent_sessions.append({
            "id": str(s.id),
            "subject": "Study",
            "date": s.started_at.isoformat() if s.started_at else "",
            "duration_min": int((s.duration_sec or 0) / 60),
            "avg_focus": s.avg_focus_score or 0.0,
        })

    return {
        "xp_points": student.xp_points or 0,
        "streak_days": student.streak_days or 0,
        "total_sessions": total_sessions or 0,
        "total_study_time_min": int((total_duration_sec or 0) / 60),
        "focus_avg_7d": await _focus_avg_7d(db, student_uuid),
        "focus_history": await _focus_history_7d(db, student_uuid),
        "recent_sessions": recent_sessions,
    }


@router.post("/{student_id}/recommend", tags=["Students"])
async def trigger_recommendation(
    student_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can trigger recommendations")

    student_uuid = _try_uuid(student_id)
    if student_uuid is None:
        raise HTTPException(status_code=404, detail="Student not found")

    student_result = await db.execute(select(User).where(User.id == student_uuid))
    student = student_result.scalar_one_or_none()
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")

    return await generate_suggestions(student_id)
