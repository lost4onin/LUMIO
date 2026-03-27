"""
analytics.py — Pydantic schemas for analytics and classification endpoints.
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime


class FocusEventInput(BaseModel):
    """
    One 60-second window of focus data — input to the distraction classifier.

    These match the features used during XGBoost training exactly.
    The model expects them in the order defined in feature_cols.joblib.
    Sending them in a different order would silently produce wrong predictions.
    """
    avg_focus_60s: float = Field(..., ge=0.0, le=1.0)
    focus_std_60s: float = Field(..., ge=0.0)
    blink_rate: float = Field(..., ge=0.0)
    head_pose_deg: float
    time_of_day_norm: float = Field(..., ge=0.0, le=1.0)
    session_duration_sec: float = Field(..., ge=0.0)
    subject_id_encoded: int = Field(default=0, ge=0)


class ClassificationResult(BaseModel):
    """Result from the XGBoost distraction classifier."""
    cause: str          # fatigue | difficulty | environment | unknown
    confidence: float   # probability of the predicted class (0.0 to 1.0)
    label_id: int       # 0=fatigue | 1=difficulty | 2=environment | 3=unknown


class BatchClassifyRequest(BaseModel):
    """
    Request body for POST /analytics/classify.

    Why a list of events?
      A single second of data is noisy. Sending multiple events lets the
      endpoint aggregate (mean/std) over a richer time window for
      more stable predictions.
    """
    events: List[FocusEventInput]
    student_id: Optional[str] = None
    session_id: Optional[str] = None
