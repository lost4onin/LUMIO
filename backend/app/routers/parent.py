"""
parent.py — Parent-scoped endpoints.

GET /parent/sessions — session history for the parent's linked child.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Session as SessionModel, User, get_db
from app.routers.auth import get_current_user

router = APIRouter()


@router.get(
    "/sessions",
    summary="Session history for the parent's linked child",
    tags=["Parent"],
)
async def parent_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns `{sessions: [...]}`. Empty list if parent has no linked child
    or the child has no session history yet."""
    if current_user.role != "parent" or not current_user.linked_student_id:
        return {"sessions": []}

    result = await db.execute(
        select(SessionModel)
        .where(SessionModel.student_id == current_user.linked_student_id)
        .order_by(SessionModel.started_at.desc())
        .limit(50)
    )
    sessions = result.scalars().all()

    payload = []
    for s in sessions:
        duration_min = int((s.duration_sec or 0) / 60)
        payload.append({
            "id": str(s.id),
            "subject": "Study Session",  # no subjects table yet
            "started_at": s.started_at.isoformat() if s.started_at else "",
            "ended_at": s.ended_at.isoformat() if s.ended_at else "",
            "duration_min": duration_min,
            "avg_focus": s.avg_focus_score or 0.0,
            "distraction_count": s.distraction_count or 0,
        })

    return {"sessions": payload}
