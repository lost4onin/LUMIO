"""
homework.py — Homework CRUD and submission management.

POST  /homework/                        — teacher creates assignment
GET   /homework/{class_id}              — list assignments for a class
POST  /homework/{homework_id}/submit    — student submits answer
GET   /homework/{homework_id}/submissions — teacher views all submissions
PATCH /homework/submissions/{id}/grade  — teacher grades, auto-sets struggle_flag if grade < 8
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, Homework, HomeworkSubmission, User
from app.routers.auth import get_current_user
from app.schemas.homework import (
    GradeSubmission,
    HomeworkCreate,
    HomeworkResponse,
    SubmissionResponse,
    SubmitHomework,
)
from app.services.n8n_service import trigger_n8n

router = APIRouter()


def _try_uuid(value: str) -> Optional[UUID]:
    try:
        return UUID(value)
    except (ValueError, AttributeError, TypeError):
        return None


def _serialize_assignment(hw: Homework, **extra) -> dict:
    return {
        "id": str(hw.id),
        "title": hw.title,
        "description": hw.description or "",
        "due_date": hw.due_date.isoformat() if hw.due_date else "",
        "difficulty": hw.difficulty_level,
        "difficulty_level": hw.difficulty_level,
        "class_id": str(hw.class_id) if hw.class_id else None,
        "subject_id": str(hw.subject_id) if hw.subject_id else None,
        "attachment_url": hw.attachment_url,
        **extra,
    }


def _serialize_submission(sub: HomeworkSubmission, student_name: str = "") -> dict:
    return {
        "id": str(sub.id),
        "homework_id": str(sub.homework_id),
        "student_id": str(sub.student_id),
        "student_name": student_name,
        "submission_text": sub.submission_text or "",
        "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else "",
        "grade": sub.grade,
        "teacher_feedback": sub.teacher_feedback,
        "struggle_flag": sub.struggle_flag,
        "time_spent_sec": sub.time_spent_sec,
        "file_url": sub.file_url,
    }


@router.post("/", status_code=201, summary="Create homework assignment", tags=["Homework"])
async def create_homework(
    body: HomeworkCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create homework")

    hw = Homework(
        teacher_id=current_user.id,
        title=body.title,
        description=body.description,
        class_id=body.class_id,
        subject_id=body.subject_id,
        due_date=body.due_date,
        difficulty_level=body.difficulty_level,
        attachment_url=body.attachment_url,
    )
    db.add(hw)
    await db.commit()
    await db.refresh(hw)
    return _serialize_assignment(hw)


@router.patch(
    "/submissions/{submission_id}/grade",
    summary="Grade a submission",
    tags=["Homework"],
)
async def grade_submission(
    submission_id: str,
    body: GradeSubmission,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can grade submissions")

    sub_uuid = _try_uuid(submission_id)
    if sub_uuid is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    result = await db.execute(
        select(HomeworkSubmission).where(HomeworkSubmission.id == sub_uuid)
    )
    submission = result.scalar_one_or_none()
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    submission.grade = body.grade
    submission.teacher_feedback = body.teacher_feedback
    # Grade below 8 (Tunisian 0–20) → auto-set struggle_flag
    if body.grade < 8:
        submission.struggle_flag = True
        await trigger_n8n("homework_struggle", {
            "student_id": str(submission.student_id),
            "submission_id": submission_id,
            "grade": body.grade,
        })

    await db.commit()
    await db.refresh(submission)

    student_result = await db.execute(select(User).where(User.id == submission.student_id))
    student = student_result.scalar_one_or_none()
    return _serialize_submission(submission, student.full_name if student else "")


@router.get(
    "/{homework_id}/submissions",
    summary="List submissions for a homework assignment",
    tags=["Homework"],
)
async def list_submissions(
    homework_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in ("teacher", "parent"):
        raise HTTPException(status_code=403, detail="Teachers and parents only")

    hw_uuid = _try_uuid(homework_id)
    if hw_uuid is None:
        return {"submissions": []}

    result = await db.execute(
        select(HomeworkSubmission, User.full_name)
        .join(User, User.id == HomeworkSubmission.student_id, isouter=True)
        .where(HomeworkSubmission.homework_id == hw_uuid)
        .order_by(HomeworkSubmission.submitted_at.desc())
    )
    rows = result.all()
    submissions = [
        _serialize_submission(sub, name or "")
        for sub, name in rows
    ]
    return {"submissions": submissions}


@router.post(
    "/{homework_id}/submit",
    status_code=201,
    summary="Submit homework",
    tags=["Homework"],
)
async def submit_homework(
    homework_id: str,
    body: SubmitHomework,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can submit homework")

    hw_uuid = _try_uuid(homework_id)
    if hw_uuid is None:
        raise HTTPException(status_code=404, detail="Homework not found")

    hw_result = await db.execute(select(Homework).where(Homework.id == hw_uuid))
    hw = hw_result.scalar_one_or_none()
    if hw is None:
        raise HTTPException(status_code=404, detail="Homework not found")

    submission = HomeworkSubmission(
        homework_id=hw_uuid,
        student_id=current_user.id,
        file_url=body.file_url,
        submission_text=body.text_submission,
        time_spent_sec=body.time_spent_sec,
        struggle_flag=body.struggle_flag,
    )
    db.add(submission)
    await db.commit()
    await db.refresh(submission)

    if body.struggle_flag:
        await trigger_n8n("homework_struggle", {
            "student_id": str(current_user.id),
            "homework_id": homework_id,
            "homework_title": hw.title,
        })

    return _serialize_submission(submission, current_user.full_name)


@router.get(
    "/{class_id}",
    summary="List homework for a class",
    tags=["Homework"],
)
async def list_homework(
    class_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns `{assignments: [...]}`. Non-UUID class_id → empty list
    (frontend uses placeholder strings like 'class-001' in dev)."""
    class_uuid = _try_uuid(class_id)
    if class_uuid is None:
        return {"assignments": []}

    result = await db.execute(
        select(Homework)
        .where(Homework.class_id == class_uuid)
        .order_by(Homework.due_date)
    )
    assignments_orm = result.scalars().all()
    if not assignments_orm:
        return {"assignments": []}

    hw_ids = [hw.id for hw in assignments_orm]

    # Count submissions per assignment (for teacher view)
    sub_count_result = await db.execute(
        select(HomeworkSubmission.homework_id, func.count(HomeworkSubmission.id))
        .where(HomeworkSubmission.homework_id.in_(hw_ids))
        .group_by(HomeworkSubmission.homework_id)
    )
    sub_counts = {hw_id: cnt for hw_id, cnt in sub_count_result.all()}

    # Total students in the class (for teacher view)
    total_students_result = await db.execute(
        select(func.count(User.id)).where(
            User.class_id == class_uuid, User.role == "student"
        )
    )
    total_students = total_students_result.scalar() or 0

    # Current student's submissions (for student view status)
    student_submissions: dict = {}
    if current_user.role == "student":
        my_subs = await db.execute(
            select(HomeworkSubmission).where(
                HomeworkSubmission.student_id == current_user.id,
                HomeworkSubmission.homework_id.in_(hw_ids),
            )
        )
        student_submissions = {s.homework_id: s for s in my_subs.scalars().all()}

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    assignments = []
    for hw in assignments_orm:
        extra = {
            "submission_count": sub_counts.get(hw.id, 0),
            "total_students": total_students,
        }
        if current_user.role == "student":
            sub = student_submissions.get(hw.id)
            if sub is not None:
                extra["status"] = "submitted"
            elif hw.due_date and hw.due_date < now:
                extra["status"] = "overdue"
            else:
                extra["status"] = "pending"
        assignments.append(_serialize_assignment(hw, **extra))

    return {"assignments": assignments}
