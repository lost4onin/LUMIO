"""
homework.py — Pydantic schemas for homework assignments and submissions.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class HomeworkCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    class_id: Optional[UUID] = None
    subject_id: Optional[UUID] = None
    due_date: Optional[datetime] = None
    difficulty_level: int = Field(default=1, ge=1, le=5)
    attachment_url: Optional[str] = None


class HomeworkResponse(BaseModel):
    id: UUID
    teacher_id: UUID
    title: str
    description: Optional[str] = None
    class_id: Optional[UUID] = None
    subject_id: Optional[UUID] = None
    due_date: Optional[datetime] = None
    difficulty_level: int
    attachment_url: Optional[str] = None

    model_config = {"from_attributes": True}


class SubmitHomework(BaseModel):
    file_url: Optional[str] = None
    time_spent_sec: Optional[int] = None
    # Student can self-report struggle; grade < 8 also auto-sets it when teacher grades
    struggle_flag: bool = False
    # Frontend submits plain text answers
    text_submission: Optional[str] = None


class SubmissionResponse(BaseModel):
    id: UUID
    homework_id: UUID
    student_id: UUID
    student_name: Optional[str] = None
    submission_text: Optional[str] = None
    submitted_at: datetime
    grade: Optional[float] = None
    teacher_feedback: Optional[str] = None
    struggle_flag: bool
    time_spent_sec: Optional[int] = None

    model_config = {"from_attributes": True}


class GradeSubmission(BaseModel):
    # Accepts Tunisian 0–20 and frontend's 0–10 scale
    grade: float = Field(..., ge=0, le=20)
    teacher_feedback: Optional[str] = None
