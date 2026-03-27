"""
analytics.py — Analytics and ML classification endpoints.

Day 4 scope:
  POST /analytics/classify      — focus events → XGBoost → distraction cause
  GET  /analytics/focus-events  — paginated historical focus events

Why load the model at module level?
  If we loaded the model inside the route function, every single request would
  read ~5 MB from disk and deserialize it — adding ~100ms per request.
  Loading once at startup means all requests share the same in-memory model
  object and inference takes ~5ms regardless of traffic.

  The tradeoff: if the model file is missing at startup, the endpoint returns
  503 (service unavailable) rather than 404 — but we log a clear warning.
"""
import joblib
import numpy as np
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db, FocusEvent
from app.routers.auth import get_current_user
from app.schemas.analytics import BatchClassifyRequest, ClassificationResult, FocusEventInput

router = APIRouter()

# ── Model loading (runs once at FastAPI startup) ───────────────────────────────
# Maps the integer label the model predicts back to a human-readable cause name.
CAUSE_LABELS = {
    0: "fatigue",
    1: "difficulty",
    2: "environment",
    3: "unknown",
}

# Path relative to this file: app/routers/ → app/ → /app (container root) → models/
# Inside Docker: volume mounts ./backend → /app, so models/ lives at /app/models/
# __file__ = /app/app/routers/analytics.py
# .parent.parent.parent = /app  (routers → app → /app)
_model_path = Path(__file__).parent.parent.parent / "models" / "distraction_clf.joblib"
_cols_path  = Path(__file__).parent.parent.parent / "models" / "feature_cols.joblib"

_model = None
_feature_cols = None

try:
    _model = joblib.load(_model_path)
    _feature_cols = joblib.load(_cols_path)
    print(f"[analytics] XGBoost model loaded from {_model_path}")
except FileNotFoundError:
    # This is expected on first startup before training has been run.
    # The endpoint gracefully returns 503 instead of crashing.
    print(f"[analytics] WARNING: Model not found at {_model_path}")
    print("[analytics] Run: python scripts/generate_training_data.py")
    print("[analytics] Then: python scripts/train_classifier.py")


# ── POST /analytics/classify ──────────────────────────────────────────────────
@router.post("/classify", response_model=ClassificationResult)
async def classify(body: BatchClassifyRequest):
    """
    Classify why a student is distracted using the XGBoost model.

    Input: a list of FocusEventInput objects (one per 60s window).
    Output: the most likely distraction cause + confidence score.

    Why aggregate multiple events?
      Each FocusEventInput is already a 60-second summary (avg_focus_60s, etc.).
      If the caller sends multiple windows, we aggregate them to get a
      more stable prediction over a longer observation period.

    Feature aggregation strategy:
      avg_focus_60s       → mean across events (overall focus level)
      focus_std_60s       → mean std across events (how variable focus is)
      blink_rate          → mean blink rate
      head_pose_deg       → mean head rotation
      time_of_day_norm    → mean (representative time of the observation)
      session_duration_sec → max (how long the session has been running)
      subject_id_encoded  → first event (subject doesn't change mid-session)
    """
    if _model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model not available. Run the training scripts first.",
        )

    events = body.events
    if not events:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="events list cannot be empty",
        )

    # Aggregate all events into a single feature vector
    # numpy makes this clean: stack into a 2D array, then take column-wise stats
    focus_scores = np.array([e.avg_focus_60s for e in events])
    features = {
        'avg_focus_60s':        float(np.mean(focus_scores)),
        'focus_std_60s':        float(np.mean([e.focus_std_60s for e in events])),
        'blink_rate':           float(np.mean([e.blink_rate for e in events])),
        'head_pose_deg':        float(np.mean([e.head_pose_deg for e in events])),
        'time_of_day_norm':     float(np.mean([e.time_of_day_norm for e in events])),
        'session_duration_sec': float(np.max([e.session_duration_sec for e in events])),
        'subject_id_encoded':   int(events[0].subject_id_encoded),
    }

    # Build feature row in the exact column order the model was trained with.
    # _feature_cols is loaded from feature_cols.joblib — the same list that
    # was used during training. This prevents silent feature-order bugs.
    feature_row = [[features[col] for col in _feature_cols]]

    # model.predict() returns an array of integer label IDs
    label_id = int(_model.predict(feature_row)[0])

    # model.predict_proba() returns shape (1, 4) — probabilities for each class.
    # We take the max as the confidence for the predicted class.
    proba = _model.predict_proba(feature_row)[0]
    confidence = float(proba[label_id])

    return ClassificationResult(
        cause=CAUSE_LABELS[label_id],
        confidence=round(confidence, 4),
        label_id=label_id,
    )


# ── GET /analytics/focus-events ───────────────────────────────────────────────
@router.get("/focus-events")
async def list_focus_events(
    student_id: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return paginated focus events from the database.

    Who can query what:
      student → only their own events (student_id param ignored)
      teacher → can query any student's events via ?student_id=<uuid>

    Why pagination?
      focus_events is the highest-volume table — one row per second per student.
      A 2-hour session = 7200 rows. Always paginate with limit/offset.
    """
    q = select(FocusEvent)

    if current_user.role == "student":
        # Students can only see their own events regardless of query param
        q = q.where(FocusEvent.student_id == current_user.id)
    elif student_id:
        # Teachers can filter by a specific student
        q = q.where(FocusEvent.student_id == student_id)

    q = q.order_by(FocusEvent.ts.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    events = result.scalars().all()

    return [
        {
            "id":            e.id,
            "session_id":    str(e.session_id),
            "student_id":    str(e.student_id),
            "ts":            e.ts,
            "gaze_score":    e.gaze_score,
            "blink_rate":    e.blink_rate,
            "head_pose_deg": e.head_pose_deg,
            "focus_score":   e.focus_score,
            "predicted_cause": e.predicted_cause,
        }
        for e in events
    ]
