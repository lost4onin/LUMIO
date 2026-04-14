"""
homework.py — Homework assignment and submission endpoints.

Role rules:
  - Teacher  → create homework, view all submissions, trigger analysis
  - Student  → submit homework, view own assignments
  - Parent   → view assignments for their linked child
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Homework, HomeworkSubmission, User, get_db
from app.routers.auth import get_current_user
from app.services.alerts import fire_alert
from app.services.rag_service import get_llm
from langchain.schema import HumanMessage, SystemMessage

router = APIRouter()


# ── Request / Response schemas ────────────────────────────────────────────────

class HomeworkCreate(BaseModel):
    title: str
    subject: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    assigned_to: List[str] = []   # list of student UUID strings


class HomeworkResponse(BaseModel):
    id: str
    teacher_id: str
    title: str
    subject: Optional[str]
    description: Optional[str]
    due_date: Optional[datetime]
    difficulty_level: int
    assigned_to: Optional[List[str]]


class SubmitRequest(BaseModel):
    struggle_flag: bool = False
    file_url: Optional[str] = None
    time_spent_sec: Optional[int] = None


class SubmissionResponse(BaseModel):
    id: str
    homework_id: str
    student_id: str
    submitted_at: datetime
    grade: Optional[float]
    struggle_flag: bool
    teacher_feedback: Optional[str]
    analysis: Optional[str]


class HomeworkWithStatus(BaseModel):
    homework: HomeworkResponse
    submitted: bool
    submission_id: Optional[str]
    struggle_flag: Optional[bool]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _hw_to_response(hw: Homework) -> HomeworkResponse:
    return HomeworkResponse(
        id=str(hw.id),
        teacher_id=str(hw.teacher_id),
        title=hw.title,
        subject=hw.subject,
        description=hw.description,
        due_date=hw.due_date,
        difficulty_level=hw.difficulty_level,
        assigned_to=hw.assigned_to,
    )


def _sub_to_response(sub: HomeworkSubmission) -> SubmissionResponse:
    return SubmissionResponse(
        id=str(sub.id),
        homework_id=str(sub.homework_id),
        student_id=str(sub.student_id),
        submitted_at=sub.submitted_at,
        grade=sub.grade,
        struggle_flag=sub.struggle_flag,
        teacher_feedback=sub.teacher_feedback,
        analysis=sub.analysis,
    )


def _require_role(user: User, *roles: str) -> None:
    if user.role not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


# ── POST /homework/ ───────────────────────────────────────────────────────────

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=HomeworkResponse)
async def create_homework(
    body: HomeworkCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_role(current_user, "teacher")

    hw = Homework(
        teacher_id=current_user.id,
        title=body.title,
        subject=body.subject,
        description=body.description,
        due_date=body.due_date,
        assigned_to=body.assigned_to if body.assigned_to else None,
    )
    db.add(hw)
    await db.commit()
    await db.refresh(hw)
    return _hw_to_response(hw)


# ── POST /homework/{homework_id}/submit ───────────────────────────────────────

@router.post("/{homework_id}/submit", status_code=status.HTTP_201_CREATED, response_model=SubmissionResponse)
async def submit_homework(
    homework_id: UUID,
    body: SubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_role(current_user, "student")

    hw_result = await db.execute(select(Homework).where(Homework.id == homework_id))
    hw = hw_result.scalar_one_or_none()
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")

    sub = HomeworkSubmission(
        homework_id=homework_id,
        student_id=current_user.id,
        file_url=body.file_url,
        struggle_flag=body.struggle_flag,
        time_spent_sec=body.time_spent_sec,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)

    if body.struggle_flag:
        # Look up parent and teacher for the alert payload
        parent_result = await db.execute(
            select(User).where(
                User.role == "parent",
                User.linked_student_id == current_user.id,
            )
        )
        parent = parent_result.scalar_one_or_none()

        teacher_result = await db.execute(select(User).where(User.id == hw.teacher_id))
        teacher = teacher_result.scalar_one_or_none()

        await fire_alert("struggle_detected", {
            "student_name": current_user.full_name,
            "homework_title": hw.title,
            "subject": hw.subject or hw.title,
            "parent_email": parent.email if parent else "",
            "teacher_email": teacher.email if teacher else "",
        })

    return _sub_to_response(sub)


# ── GET /homework/{homework_id}/submissions ───────────────────────────────────

@router.get("/{homework_id}/submissions", response_model=List[SubmissionResponse])
async def list_submissions(
    homework_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_role(current_user, "teacher")

    hw_result = await db.execute(select(Homework).where(Homework.id == homework_id))
    if not hw_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Homework not found")

    result = await db.execute(
        select(HomeworkSubmission).where(HomeworkSubmission.homework_id == homework_id)
    )
    return [_sub_to_response(s) for s in result.scalars().all()]


# ── GET /homework/student/{student_id} ───────────────────────────────────────

@router.get("/student/{student_id}", response_model=List[HomeworkWithStatus])
async def list_student_homework(
    student_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Access control: teacher, the student themselves, or their parent
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if current_user.role == "parent" and current_user.linked_student_id != student_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if current_user.role not in ("teacher", "student", "parent"):
        raise HTTPException(status_code=403, detail="Forbidden")

    # All homework where this student is in assigned_to, or assigned_to is null
    hw_result = await db.execute(select(Homework))
    all_hw = hw_result.scalars().all()

    # Filter: null assigned_to means class-wide; otherwise check list membership
    student_id_str = str(student_id)
    relevant = [
        hw for hw in all_hw
        if hw.assigned_to is None or student_id_str in hw.assigned_to
    ]

    # Fetch all submissions for this student in one query
    sub_result = await db.execute(
        select(HomeworkSubmission).where(HomeworkSubmission.student_id == student_id)
    )
    submissions_by_hw = {str(s.homework_id): s for s in sub_result.scalars().all()}

    output = []
    for hw in relevant:
        sub = submissions_by_hw.get(str(hw.id))
        output.append(HomeworkWithStatus(
            homework=_hw_to_response(hw),
            submitted=sub is not None,
            submission_id=str(sub.id) if sub else None,
            struggle_flag=sub.struggle_flag if sub else None,
        ))
    return output


# ── POST /homework/{homework_id}/submissions/{submission_id}/analyze ──────────

@router.post(
    "/{homework_id}/submissions/{submission_id}/analyze",
    response_model=dict,
)
async def analyze_submission(
    homework_id: UUID,
    submission_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_role(current_user, "teacher")

    sub_result = await db.execute(
        select(HomeworkSubmission).where(
            HomeworkSubmission.id == submission_id,
            HomeworkSubmission.homework_id == homework_id,
        )
    )
    sub = sub_result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    hw_result = await db.execute(select(Homework).where(Homework.id == homework_id))
    hw = hw_result.scalar_one_or_none()

    subject = hw.subject or hw.title if hw else "the subject"
    grade_info = f" (grade: {sub.grade}/20)" if sub.grade is not None else ""
    struggle_info = " The student flagged this as difficult." if sub.struggle_flag else ""

    prompt = (
        f"Given this student's homework submission in {subject}{grade_info},{struggle_info} "
        "identify potential learning difficulties. "
        "Be supportive and constructive. "
        "Never diagnose — only suggest areas for additional support."
    )

    try:
        llm = get_llm()
        response = await llm.ainvoke([
            SystemMessage(content=(
                "You are a supportive pedagogical assistant. "
                "Give brief, constructive learning-difficulty analysis in 2-3 sentences. "
                "Never use: ADHD, disorder, diagnosis, condition, autism."
            )),
            HumanMessage(content=prompt),
        ])
        analysis_text = response.content.strip()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Analysis unavailable: {exc}",
        )

    sub.analysis = analysis_text
    await db.commit()

    return {"submission_id": str(sub.id), "analysis": analysis_text}
