"""
rag.py — RAG-powered AI assistant endpoints.

POST /rag/teacher  — teacher asks about a student or general strategy
POST /rag/parent   — parent asks about supporting their child
POST /rag/student  — student asks for study help

Each endpoint uses a different system prompt and safety filter so the LLM
gives age/role-appropriate responses. risk_score is NEVER returned to parents.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.database import get_db, User
from app.routers.auth import get_current_user
from app.services.rag_service import query_rag, is_index_loaded
from app.services.rule_engine import classify_archetype, ARCHETYPE_RAG_SEEDS
from app.schemas.rag import RAGRequest, RAGResponse

router = APIRouter()


def _index_guard():
    """Raise 503 if the FAISS index hasn't loaded yet."""
    if not is_index_loaded():
        raise HTTPException(status_code=503, detail="RAG index not ready")


@router.post("/teacher", response_model=RAGResponse)
async def rag_teacher(
    body: RAGRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _index_guard()

    if body.student_id:
        result_row = await db.execute(
            select(User).where(User.id == UUID(body.student_id))
        )
        student = result_row.scalar_one_or_none()
        if student is None:
            raise HTTPException(status_code=404, detail="Student not found")

        student_context = {
            "full_name": student.full_name,
            "avg_focus_7d": 0.5,
            "distraction_cause": "unknown",
        }
        rule_result = classify_archetype("unknown", risk_score=0.0)
        archetype = rule_result.archetype
        referral = rule_result.professional_referral
        seed = rule_result.rag_query_seed
    else:
        archetype = "GENERAL_DISTRACTION"
        seed = ARCHETYPE_RAG_SEEDS["GENERAL_DISTRACTION"]
        student_context = {}
        referral = False

    rag_result = await query_rag(archetype, seed, student_context, referral, "teacher")

    return RAGResponse(
        answer=rag_result["summary"],
        for_teacher=rag_result["for_teacher"],
        for_student=rag_result["for_student"],
        for_parent=rag_result["for_parent"],
        sources=rag_result["sources"],
        archetype=archetype,
        urgency=rag_result["urgency"],
        professional_referral=rag_result["professional_referral"],
    )


@router.post("/parent", response_model=RAGResponse)
async def rag_parent(
    body: RAGRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _index_guard()

    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can use this endpoint")

    if not body.student_id:
        raise HTTPException(status_code=422, detail="student_id is required for parent endpoint")

    result_row = await db.execute(
        select(User).where(User.id == UUID(body.student_id))
    )
    student = result_row.scalar_one_or_none()
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")

    student_context = {
        "full_name": student.full_name,
        "avg_focus_7d": 0.5,
        "distraction_cause": "unknown",
    }
    rule_result = classify_archetype("unknown", risk_score=0.0)
    archetype = rule_result.archetype
    referral = rule_result.professional_referral
    seed = rule_result.rag_query_seed

    rag_result = await query_rag(archetype, seed, student_context, referral, "parent")

    # RAGResponse has no risk_score field — parent never sees it
    return RAGResponse(
        answer=rag_result["summary"],
        for_teacher=rag_result["for_teacher"],
        for_student=rag_result["for_student"],
        for_parent=rag_result["for_parent"],
        sources=rag_result["sources"],
        archetype=archetype,
        urgency=rag_result["urgency"],
        professional_referral=rag_result["professional_referral"],
    )


@router.post("/student", response_model=RAGResponse)
async def rag_student(
    body: RAGRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _index_guard()

    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can use this endpoint")

    student_context = {"full_name": current_user.full_name}
    archetype = "GENERAL_DISTRACTION"
    seed = ARCHETYPE_RAG_SEEDS["GENERAL_DISTRACTION"]

    rag_result = await query_rag(archetype, seed, student_context, False, "student")

    return RAGResponse(
        answer=rag_result["summary"],
        for_teacher=rag_result["for_teacher"],
        for_student=rag_result["for_student"],
        for_parent=rag_result["for_parent"],
        sources=rag_result["sources"],
        archetype=archetype,
        urgency=rag_result["urgency"],
        professional_referral=rag_result["professional_referral"],
    )
