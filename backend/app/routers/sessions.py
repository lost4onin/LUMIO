"""
sessions.py — Session management and real-time focus streaming.

Day 3 scope:
  POST /sessions/start            — student starts a study session
  POST /sessions/end              — student ends a session (computes duration)
  GET  /sessions/                 — list sessions (student sees own, teacher sees all)
  WS   /sessions/ws/focus/{id}    — student streams focus scores (1 msg/sec)
  WS   /sessions/ws/class/{id}    — teacher receives live focus updates

Data flow for the WebSocket pipeline:
  Browser (MediaPipe) → WS /ws/focus → Redis SET (live data)
                                      → Redis PUBLISH (channel)
                                      → WS /ws/class ← Teacher dashboard
                      → every 60s: batch INSERT → PostgreSQL focus_events

Why Redis pub/sub instead of a shared in-memory dict?
  If we scaled to multiple FastAPI worker processes, an in-memory dict in
  process A would not be visible to process B. Redis acts as a message broker
  that all processes share, so any worker can publish/subscribe.
"""
import json
import asyncio
from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.database import get_db, Session as SessionModel, FocusEvent, AsyncSessionLocal
from app.routers.auth import get_current_user
from app.services.redis_service import get_redis
from app.schemas.session import SessionStart, SessionEnd, SessionResponse, FocusPayload

router = APIRouter()

# Root-level router for WebSocket endpoints. Mounted with prefix="" in main.py
# so the frontend can connect to /ws/focus/{id} and /ws/class/{id} directly.
ws_router = APIRouter()


# ── POST /sessions/start ──────────────────────────────────────────────────────
@router.post("/start", status_code=201)
async def start_session(
    body: SessionStart,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new session row and return {session_id, ...}.

    Accepts either {subject_id: UUID, cv_used} or the frontend's
    {student_id, subject: 'Math'} shape. Subject strings are not persisted
    (no subjects table yet) — they're accepted for forward compatibility.
    """
    if current_user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can start sessions",
        )

    session = SessionModel(
        student_id=current_user.id,
        subject_id=body.subject_id,
        cv_used=body.cv_used,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return {
        "session_id": str(session.id),
        "id": str(session.id),
        "student_id": str(session.student_id),
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "ended_at": None,
        "duration_sec": None,
        "avg_focus_score": None,
        "distraction_count": session.distraction_count or 0,
        "cv_used": session.cv_used,
    }


# ── POST /sessions/end ────────────────────────────────────────────────────────
@router.post("/end", response_model=SessionResponse)
async def end_session(
    body: SessionEnd,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark a session as ended. Computes duration_sec = ended_at - started_at.

    Why re-fetch after update?
      db.execute(update(...)) sends SQL to the DB but doesn't update the
      Python object in memory. We re-query to get the freshly updated row.
    """
    result = await db.execute(
        select(SessionModel).where(SessionModel.id == body.session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    now = datetime.now(timezone.utc)

    # asyncpg returns timezone-aware datetimes, but add a safety fallback
    # in case the DB driver strips timezone info in some configurations
    started_at = session.started_at
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)

    duration_sec = int((now - started_at).total_seconds())

    await db.execute(
        update(SessionModel)
        .where(SessionModel.id == body.session_id)
        .values(ended_at=now, duration_sec=duration_sec)
    )
    await db.commit()

    # Re-fetch the updated row
    result = await db.execute(
        select(SessionModel).where(SessionModel.id == body.session_id)
    )
    updated = result.scalar_one_or_none()
    return SessionResponse.model_validate(updated)


# ── GET /sessions/ ────────────────────────────────────────────────────────────
@router.get("/", response_model=List[SessionResponse])
async def list_sessions(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List sessions ordered by most recent first, limited to 50.

    Role-based filtering:
      student → sees only their own sessions
      teacher / parent → sees all sessions (teacher needs this for the dashboard)
    """
    if current_user.role == "student":
        q = select(SessionModel).where(SessionModel.student_id == current_user.id)
    else:
        q = select(SessionModel)

    q = q.order_by(SessionModel.started_at.desc()).limit(50)
    result = await db.execute(q)
    sessions = result.scalars().all()
    return [SessionResponse.model_validate(s) for s in sessions]


# ── Helper: flush focus buffer to PostgreSQL ──────────────────────────────────
async def _flush_to_db(buffer: list) -> None:
    """
    Batch INSERT all buffered focus events into the focus_events table.

    Why a separate DB session?
      WebSocket endpoints run for the full duration of the connection —
      they don't have the usual request/response lifecycle that get_db() manages.
      We open our own session here to avoid mixing concerns.

    Why skip non-UUID ids?
      During testing with wscat we send arbitrary strings like "test-student-123".
      These can't satisfy the UUID foreign key constraint. We skip gracefully
      and log a warning so the Redis pipeline still works end-to-end.
    """
    async with AsyncSessionLocal() as db:
        try:
            inserted = 0
            for item in buffer:
                # Validate both UUIDs before attempting an INSERT
                try:
                    session_uuid = UUID(str(item["session_id"]))
                    student_uuid = UUID(str(item["student_id"]))
                except (ValueError, AttributeError):
                    print(
                        f"[focus] Skipping DB insert — non-UUID ids: "
                        f"session={item['session_id']} student={item['student_id']}"
                    )
                    continue

                event = FocusEvent(
                    session_id=session_uuid,
                    student_id=student_uuid,
                    # gaze_score: FocusEvent stores a single gaze value.
                    # We compute a simple composite: average of x and y coordinates.
                    # Day 4+ can refine this with a proper gaze metric.
                    gaze_score=(item["gaze_x"] + item["gaze_y"]) / 2.0,
                    blink_rate=item["blink_rate"],
                    head_pose_deg=item["head_pose_deg"],
                    focus_score=item["focus_score"],
                    ts=item["ts"],
                )
                db.add(event)
                inserted += 1

            await db.commit()
            print(f"[focus] Flushed {inserted}/{len(buffer)} events to DB.")
        except Exception as exc:
            await db.rollback()
            print(f"[focus] DB flush error: {exc}")


# ── WS /ws/focus/{student_id} ────────────────────────────────────────────────
@ws_router.websocket("/ws/focus/{student_id}")
async def ws_focus(websocket: WebSocket, student_id: str):
    """
    Student's browser connects here and sends FocusPayload JSON every 1 second.

    Per-message actions:
      1. Parse raw JSON → FocusPayload (validates field types and ranges)
      2. Build live_data dict (subset of fields used by Redis + teacher dashboard)
      3. SET Redis key "session:live:{student_id}" = live_data JSON, TTL=7200s
         (teacher can read latest snapshot at any time, data expires after 2h)
      4. PUBLISH to "pubsub:class:{class_id}" so teacher WS receives it instantly
      5. Append to in-memory buffer list

    Batch write (every 60 seconds):
      Flush the entire buffer to PostgreSQL focus_events as a batch INSERT.
      Doing it every second would hammer the DB with 30 students × 1 insert/sec.
      Batching reduces DB load while keeping Redis data real-time.

    The asyncio.sleep(0) at the end of each loop iteration yields control
    back to the event loop so other coroutines (other WebSocket connections)
    can run. Without it this loop would monopolize the thread.
    """
    await websocket.accept()
    redis = await get_redis()

    buffer: list = []
    last_flush = datetime.now(timezone.utc)

    try:
        while True:
            raw = await websocket.receive_text()

            # Validate the incoming JSON
            try:
                payload = FocusPayload.model_validate_json(raw)
            except Exception as exc:
                await websocket.send_text(json.dumps({"error": f"Invalid payload: {exc}"}))
                continue

            # Build the live snapshot dict
            live_data = {
                "focus_score":   payload.focus_score,
                "gaze_x":        payload.gaze_x,
                "gaze_y":        payload.gaze_y,
                "blink_rate":    payload.blink_rate,
                "head_pose_deg": payload.head_pose_deg,
                "session_id":    payload.session_id,
                "ts":            payload.ts,
            }

            # 3. Store latest reading in Redis with 2-hour TTL
            #    Key pattern: session:live:{student_id}
            #    Any teacher or parent can read this key to see a student's latest score.
            await redis.set(
                f"session:live:{student_id}",
                json.dumps(live_data),
                ex=7200,
            )

            # 4. Publish to the class pub/sub channel.
            #    The teacher's WebSocket (ws_class below) is subscribed to this channel
            #    and will forward the message to the teacher's browser immediately.
            publish_msg = json.dumps({"student_id": student_id, **live_data})
            await redis.publish(f"pubsub:class:{payload.class_id}", publish_msg)

            # Visible log so we can verify the pipeline works during testing
            print(
                f"[focus] student={student_id} "
                f"class={payload.class_id} "
                f"score={payload.focus_score:.3f}"
            )

            # 5. Buffer for batch DB write
            buffer.append({
                "session_id":    payload.session_id,
                "student_id":    student_id,
                "gaze_x":        payload.gaze_x,
                "gaze_y":        payload.gaze_y,
                "blink_rate":    payload.blink_rate,
                "head_pose_deg": payload.head_pose_deg,
                "focus_score":   payload.focus_score,
                "ts":            datetime.fromtimestamp(payload.ts, tz=timezone.utc),
            })

            # 6. Every 60 seconds: flush buffer → DB
            now = datetime.now(timezone.utc)
            elapsed = (now - last_flush).total_seconds()
            if elapsed >= 60 and buffer:
                await _flush_to_db(buffer)
                buffer.clear()
                last_flush = now

            # Yield to the event loop — allows other WebSocket connections to run
            await asyncio.sleep(0)

    except WebSocketDisconnect:
        print(
            f"[focus] student={student_id} disconnected. "
            f"Flushing {len(buffer)} buffered events to DB."
        )
        # Final flush on disconnect so no data is lost
        if buffer:
            await _flush_to_db(buffer)


# ── WS /ws/class/{class_id} ──────────────────────────────────────────────────
@ws_router.websocket("/ws/class/{class_id}")
async def ws_class(websocket: WebSocket, class_id: str):
    """
    Teacher connects here to receive live focus updates for their class.

    How it works:
      1. Create a Redis pub/sub object (separate from the main redis_client)
      2. Subscribe to "pubsub:class:{class_id}"
      3. Poll for messages in a tight loop using get_message(timeout=1.0)
         — timeout=1.0 means: wait up to 1 second for a message, then return None
         — this prevents the loop from spinning at 100% CPU
      4. Forward each message directly to the teacher's WebSocket

    Why get_message() instead of pubsub.listen()?
      pubsub.listen() is an async generator that blocks indefinitely.
      If the teacher disconnects but no new messages arrive, we'd never detect it.
      get_message(timeout=1.0) returns None after 1 second, allowing the loop to
      check for disconnects on the next send() call.
    """
    await websocket.accept()
    redis = await get_redis()

    # Create a dedicated pub/sub object for this connection
    # Each teacher connection needs its own pubsub instance
    pubsub = redis.pubsub()
    channel = f"pubsub:class:{class_id}"
    await pubsub.subscribe(channel)
    print(f"[class] Teacher subscribed to {channel}")

    try:
        while True:
            # Wait up to 1 second for a message on the channel
            message = await pubsub.get_message(
                ignore_subscribe_messages=True,
                timeout=1.0,
            )
            if message and message["type"] == "message":
                # Forward the raw JSON string directly to the teacher's browser
                await websocket.send_text(message["data"])

            # Yield control so other coroutines can run between Redis polls
            await asyncio.sleep(0)

    except WebSocketDisconnect:
        print(f"[class] Teacher disconnected from {channel}")
    finally:
        # Always clean up: unsubscribe from Redis and close the pubsub connection
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
