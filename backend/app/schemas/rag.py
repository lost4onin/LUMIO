from pydantic import BaseModel
from typing import Optional


class RAGRequest(BaseModel):
    message: str
    student_id: Optional[str] = None


class RAGResponse(BaseModel):
    answer: str
    for_teacher: list[str]
    for_student: list[str]
    for_parent: list[str]
    sources: list[str]
    archetype: Optional[str] = None
    urgency: Optional[str] = None
    professional_referral: Optional[bool] = None
