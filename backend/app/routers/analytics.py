"""
analytics.py — ML analytics and focus event classification.

POST /analytics/classify — accepts either a raw JSON array of focus events
(as the frontend sends) or {"events": [...]} wrapper. Maps frontend field
aliases (head_pose_x / head_pose_y → head_pose_deg, timestamp ignored).
"""
import os
from typing import Any, List, Union

import numpy as np
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel

from app.routers.auth import get_current_user

router = APIRouter()

CLASSIFIER_PATH = "/app/models/xgboost_classifier.pkl"
CAUSE_LABELS = ["focused", "fatigue", "environment", "difficulty"]

_classifier = None


def _get_classifier():
    global _classifier
    if _classifier is None and os.path.exists(CLASSIFIER_PATH):
        import joblib
        _classifier = joblib.load(CLASSIFIER_PATH)
    return _classifier


class FocusEventInput(BaseModel):
    gaze_score: float = 0.0
    blink_rate: float = 0.0
    head_pose_deg: float = 0.0
    focus_score: float = 0.0


class ClassifyResponse(BaseModel):
    cause: str
    confidence: float


def _normalize_event(raw: dict) -> FocusEventInput:
    # head_pose_deg may come in as head_pose_x or head_pose_y
    head_pose = raw.get("head_pose_deg")
    if head_pose is None:
        head_pose = raw.get("head_pose_x") or raw.get("head_pose_y") or 0.0
    return FocusEventInput(
        gaze_score=float(raw.get("gaze_score", raw.get("focus_score", 0.0)) or 0.0),
        blink_rate=float(raw.get("blink_rate", 0.0) or 0.0),
        head_pose_deg=float(head_pose or 0.0),
        focus_score=float(raw.get("focus_score", 0.0) or 0.0),
    )


def _heuristic_classify(events: List[FocusEventInput]) -> ClassifyResponse:
    avg_focus = sum(e.focus_score for e in events) / len(events)
    avg_blink = sum(e.blink_rate for e in events) / len(events)
    avg_head = sum(abs(e.head_pose_deg) for e in events) / len(events)

    if avg_focus < 0.3 or avg_blink > 28:
        return ClassifyResponse(cause="fatigue", confidence=0.72)
    elif avg_head > 20:
        return ClassifyResponse(cause="environment", confidence=0.63)
    elif avg_focus < 0.45:
        return ClassifyResponse(cause="difficulty", confidence=0.58)
    else:
        return ClassifyResponse(cause="focused", confidence=0.80)


@router.post(
    "/classify",
    response_model=ClassifyResponse,
    summary="Classify distraction cause",
    tags=["Analytics"],
)
async def classify_distraction(
    body: Union[List[dict], dict] = Body(...),
    current_user=Depends(get_current_user),
):
    """Accepts either a raw list or {events: [...]} wrapper."""
    if isinstance(body, list):
        raw_events = body
    elif isinstance(body, dict):
        raw_events = body.get("events", [])
    else:
        raise HTTPException(status_code=422, detail="Invalid payload")

    if not raw_events:
        raise HTTPException(status_code=422, detail="events list cannot be empty")

    events = [_normalize_event(e) for e in raw_events]

    model = _get_classifier()
    if model is not None:
        features = np.array([
            [e.gaze_score, e.blink_rate, e.head_pose_deg, e.focus_score]
            for e in events
        ])
        proba = model.predict_proba(features).mean(axis=0)
        pred_idx = int(np.argmax(proba))
        labels = list(model.classes_) if hasattr(model, "classes_") else CAUSE_LABELS
        cause = labels[pred_idx % len(labels)]
        confidence = float(proba[pred_idx])
        return ClassifyResponse(cause=cause, confidence=confidence)

    return _heuristic_classify(events)
