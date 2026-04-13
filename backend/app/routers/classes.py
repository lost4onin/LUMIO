"""
classes.py — Class management endpoints.

GET /classes/{class_id}/students — list students in a class with live focus from Redis
                                   and latest risk_tier from adhd_risk_profiles.

Used by the teacher dashboard to show a live classroom view.
"""
import json
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, User, ADHDRiskProfile
from app.routers.auth import get_current_user
from app.services.redis_service import get_redis

router = APIRouter()


@router.get(
    "/{class_id}/students",
    summary="List students in a class with live focus and risk tier",
    description="Returns each student's name, live focus score from Redis, and latest risk_tier. Teachers only.",
    tags=["Classes"],
)
async def list_class_students(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in ("teacher",):
        raise HTTPException(status_code=403, detail="Teachers only")

    try:
        class_uuid = UUID(class_id)
    except (ValueError, AttributeError, TypeError):
        # Frontend uses placeholder class IDs in dev — return empty list
        return {"students": []}

    # Fetch all students in this class
    result = await db.execute(
        select(User).where(User.class_id == class_uuid, User.role == "student")
    )
    students = result.scalars().all()

    # Fetch latest risk profiles for all students in one query
    student_ids = [s.id for s in students]
    profiles_result = await db.execute(
        select(ADHDRiskProfile)
        .where(ADHDRiskProfile.student_id.in_(student_ids))
        .order_by(ADHDRiskProfile.computed_at.desc())
    )
    # Keep only the latest profile per student
    risk_map: dict = {}
    for profile in profiles_result.scalars().all():
        sid = str(profile.student_id)
        if sid not in risk_map:
            risk_map[sid] = profile.risk_tier

    redis = await get_redis()
    response = []
    for student in students:
        # Read live focus from Redis key set by the WebSocket focus stream
        live_raw = await redis.get(f"session:live:{student.id}")
        live_focus = None
        if live_raw:
            try:
                live_focus = json.loads(live_raw).get("focus_score")
            except Exception:
                pass

        response.append({
            "id": str(student.id),
            "name": student.full_name,
            "email": student.email,
            "live_focus_score": live_focus,
            "is_live": live_focus is not None,
            "risk_tier": risk_map.get(str(student.id)) or "low",
        })

    return {"students": response}
