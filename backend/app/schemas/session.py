"""
session.py — Pydantic schemas for session and focus events.

Why separate schemas from DB models?
  ORM models describe the database table structure.
  Pydantic schemas describe what JSON looks like over the wire.
  They are intentionally separate — the DB might have columns you never expose,
  and the API might accept fields that don't map 1:1 to columns.
"""
from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class SessionStart(BaseModel):
    """Body for POST /sessions/start — all fields optional.

    Accepts legacy {subject_id: UUID, cv_used: bool} and the frontend's
    {student_id, subject: 'Math'} shape. Unknown subject strings are ignored.
    """
    subject_id: Optional[UUID] = None
    subject: Optional[str] = None
    student_id: Optional[str] = None
    cv_used: bool = False


class SessionEnd(BaseModel):
    """Body for POST /sessions/end — identifies which session to close."""
    session_id: UUID


class SessionResponse(BaseModel):
    """
    Returned by start, end, and list endpoints.

    model_config from_attributes=True tells Pydantic to read values
    from ORM object attributes (e.g. session.id) instead of dict keys.
    Without this, SessionResponse.model_validate(orm_object) would fail.
    """
    id: UUID
    student_id: UUID
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_sec: Optional[int] = None
    avg_focus_score: Optional[float] = None
    distraction_count: int
    cv_used: bool

    model_config = {"from_attributes": True}


class FocusPayload(BaseModel):
    """
    JSON sent by the student's browser every 1 second via WebSocket.
    MediaPipe computes these values client-side — no video ever transmitted.

    Field constraints enforce valid ranges at the boundary (Pydantic raises
    422 Unprocessable Entity if the browser sends out-of-range values):
      gaze_x / gaze_y: normalized screen coordinates [0.0, 1.0]
      focus_score:     aggregated focus metric [0.0, 1.0]
      blink_rate:      blinks per minute, always >= 0
    """
    gaze_x: float = Field(..., ge=0.0, le=1.0)
    gaze_y: float = Field(..., ge=0.0, le=1.0)
    blink_rate: float = Field(..., ge=0.0)
    head_pose_deg: float          # degrees from neutral — can be negative (tilt left)
    focus_score: float = Field(..., ge=0.0, le=1.0)
    class_id: str                 # which class channel to publish to
    session_id: Optional[str] = None  # optional — frontend may omit it
    ts: float                     # Unix timestamp (seconds) from the browser clock
