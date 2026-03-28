"""
recommender.py — Full AI recommendation pipeline.

Steps:
1. Fetch student from DB
2. Get latest distraction cause from last 60 focus_events (most frequent cause wins)
3. Get latest homework grade
4. Run rule engine → archetype + rag_query_seed + professional_referral
5. FAISS retrieval → top-4 clinical chunks   |
6. Groq LLM → structured JSON suggestions    | all handled inside query_rag()
7. Pydantic-style blacklist validation        |
8. Two-strike fallback                        |
9. Store in adhd_risk_profiles, return result

CRITICAL SAFETY RULES:
  - professional_referral is ALWAYS set by the rule engine, never by the LLM
  - risk_score is NEVER returned by the parent-facing endpoints (enforced in router)
  - Diagnosis language is filtered inside query_rag (Day 6)
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from datetime import datetime, timezone

from app.database import User, FocusEvent, HomeworkSubmission, ADHDRiskProfile
from app.services.rule_engine import classify_archetype
from app.services.rag_service import query_rag


async def generate_recommendations(
    student_id: str,
    db: AsyncSession,
    risk_score: float = 0.0,
    streak_days: int = 0,
) -> dict:
    """
    Run the full 9-step pipeline for a student and persist the result.

    Args:
        student_id:   UUID string of the student
        db:           async DB session (injected by FastAPI)
        risk_score:   0.0–1.0 from the risk profiler (default 0.0 if not yet computed)
        streak_days:  consecutive days with distraction flags (from user.streak_days)

    Returns:
        dict with archetype, risk_tier, professional_referral, urgency, suggested_actions
    """
    # ── Step 1: Fetch student ────────────────────────────────────────────────
    result = await db.execute(select(User).where(User.id == UUID(student_id)))
    student = result.scalar_one_or_none()
    if not student:
        raise ValueError(f"Student {student_id} not found")

    # ── Step 2: Derive distraction cause from last 60 focus events ───────────
    # 60 events = roughly the last 60 seconds of a session — a meaningful window.
    # Most frequent predicted_cause wins (mode). If no events yet, fall back to "unknown".
    events_result = await db.execute(
        select(FocusEvent)
        .where(FocusEvent.student_id == UUID(student_id))
        .order_by(FocusEvent.ts.desc())
        .limit(60)
    )
    events = events_result.scalars().all()

    if events:
        causes = [e.predicted_cause for e in events if e.predicted_cause]
        distraction_cause = max(set(causes), key=causes.count) if causes else "unknown"
        focus_scores = [e.focus_score for e in events if e.focus_score is not None]
        avg_focus_7d = sum(focus_scores) / len(focus_scores) if focus_scores else 0.5
        session_duration = (
            (events[0].ts - events[-1].ts).total_seconds() if len(events) > 1 else 0
        )
    else:
        distraction_cause = "unknown"
        avg_focus_7d = 0.5
        session_duration = 0

    # ── Step 3: Get latest homework grade ────────────────────────────────────
    hw_result = await db.execute(
        select(HomeworkSubmission)
        .where(HomeworkSubmission.student_id == UUID(student_id))
        .order_by(HomeworkSubmission.submitted_at.desc())
        .limit(1)
    )
    latest_submission = hw_result.scalar_one_or_none()
    hw_grade = latest_submission.grade if latest_submission else None

    # ── Step 4: Rule engine ───────────────────────────────────────────────────
    archetype_result = classify_archetype(
        cause=distraction_cause,
        risk_score=risk_score,
        session_duration_sec=session_duration,
        hw_grade=hw_grade,
        streak_days=streak_days,
    )

    # ── Steps 5-8: FAISS → Groq → blacklist check → fallback ─────────────────
    student_context = {
        "full_name": student.full_name,
        "avg_focus_7d": round(avg_focus_7d, 2),
        "distraction_cause": distraction_cause,
    }

    rag_result = await query_rag(
        archetype=archetype_result.archetype,
        rag_query_seed=archetype_result.rag_query_seed,
        student_context=student_context,
        professional_referral_override=archetype_result.professional_referral,
        audience="teacher",
    )

    # ── Step 9: Persist in adhd_risk_profiles ─────────────────────────────────
    profile = ADHDRiskProfile(
        student_id=UUID(student_id),
        computed_at=datetime.now(timezone.utc),
        risk_score=risk_score,
        risk_tier=_score_to_tier(risk_score),
        suggested_actions=rag_result,
        professional_referral=archetype_result.professional_referral,
        seen_by_teacher=False,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)

    return {
        "student_id": student_id,
        "archetype": archetype_result.archetype,
        "risk_tier": profile.risk_tier,
        "professional_referral": archetype_result.professional_referral,
        "urgency": archetype_result.urgency,
        "suggested_actions": rag_result,
    }


def _score_to_tier(score: float) -> str:
    """Map a continuous risk score to a named tier for the dashboard."""
    if score >= 0.65:
        return "needs_attention"
    if score >= 0.35:
        return "moderate"
    return "low"
