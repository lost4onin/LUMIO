"""
test_homework.py — Tests for the homework router.

Uses FastAPI's dependency override mechanism to inject a mock DB session.
The lifespan (init_db / init_redis / init_rag) is patched to a no-op so
tests don't need a live database or Redis — they're pure unit tests.
"""
import pytest
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.database import User, Homework, HomeworkSubmission, get_db
from app.routers.auth import get_current_user

# ── Patch heavy startup functions so TestClient doesn't need real infra ───────
_noop = AsyncMock(return_value=None)
_patches = [
    patch("app.main.init_db",    _noop),
    patch("app.main.init_redis", _noop),
    patch("app.main.close_redis", _noop),
    patch("app.main.init_rag",   _noop),
]
for p in _patches:
    p.start()

import atexit
for p in _patches:
    atexit.register(p.stop)


# ── Shared fixtures ───────────────────────────────────────────────────────────

TEACHER_ID = uuid.uuid4()
STUDENT_ID = uuid.uuid4()
PARENT_ID  = uuid.uuid4()
HW_ID      = uuid.uuid4()
SUB_ID     = uuid.uuid4()

def make_teacher():
    u = MagicMock(spec=User)
    u.id        = TEACHER_ID
    u.role      = "teacher"
    u.full_name = "Mr. Test"
    u.email     = "teacher@test.com"
    return u

def make_student():
    u = MagicMock(spec=User)
    u.id        = STUDENT_ID
    u.role      = "student"
    u.full_name = "Student Test"
    u.email     = "student@test.com"
    return u

def make_parent():
    u = MagicMock(spec=User)
    u.id                = PARENT_ID
    u.role              = "parent"
    u.full_name         = "Parent Test"
    u.email             = "parent@test.com"
    u.linked_student_id = STUDENT_ID
    return u

def make_homework(subject="Maths"):
    hw = MagicMock(spec=Homework)
    hw.id             = HW_ID
    hw.teacher_id     = TEACHER_ID
    hw.title          = "Test Homework"
    hw.subject        = subject
    hw.description    = "Do exercises"
    hw.due_date       = None
    hw.difficulty_level = 1
    hw.assigned_to    = [str(STUDENT_ID)]
    return hw

def make_submission(struggle=False):
    s = MagicMock(spec=HomeworkSubmission)
    s.id              = SUB_ID
    s.homework_id     = HW_ID
    s.student_id      = STUDENT_ID
    s.submitted_at    = datetime.now(timezone.utc)
    s.grade           = None
    s.struggle_flag   = struggle
    s.teacher_feedback = None
    s.analysis        = None
    s.file_url        = None
    return s


def _mock_db_for_create():
    """DB mock that supports add/commit/refresh for homework creation."""
    db = AsyncMock()
    created_hw = make_homework()

    async def mock_refresh(obj):
        obj.id             = HW_ID
        obj.teacher_id     = TEACHER_ID
        obj.title          = getattr(obj, "title", "Test Homework")
        obj.subject        = getattr(obj, "subject", "Maths")
        obj.description    = getattr(obj, "description", None)
        obj.due_date       = None
        obj.difficulty_level = 1
        obj.assigned_to    = getattr(obj, "assigned_to", None)

    db.refresh = mock_refresh
    return db


# ── Test: teacher creates homework → 201 ─────────────────────────────────────

def test_teacher_creates_homework():
    db = _mock_db_for_create()

    app.dependency_overrides[get_current_user] = lambda: make_teacher()
    app.dependency_overrides[get_db] = lambda: db

    with TestClient(app) as client:
        resp = client.post("/homework/", json={
            "title": "Test Homework",
            "subject": "Maths",
            "description": "Do exercises",
            "assigned_to": [str(STUDENT_ID)],
        })

    app.dependency_overrides.clear()
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Test Homework"
    assert data["subject"] == "Maths"


# ── Test: student can't create homework → 403 ─────────────────────────────────

def test_student_cannot_create_homework():
    db = AsyncMock()
    app.dependency_overrides[get_current_user] = lambda: make_student()
    app.dependency_overrides[get_db] = lambda: db

    with TestClient(app) as client:
        resp = client.post("/homework/", json={
            "title": "Unauthorized",
            "subject": "Maths",
        })

    app.dependency_overrides.clear()
    assert resp.status_code == 403


# ── Test: student submits homework → 201 ──────────────────────────────────────

def test_student_submits_homework():
    hw = make_homework()
    sub = make_submission(struggle=False)

    db = AsyncMock()
    hw_scalar = MagicMock()
    hw_scalar.scalar_one_or_none = MagicMock(return_value=hw)
    db.execute = AsyncMock(return_value=hw_scalar)

    async def mock_refresh(obj):
        obj.id           = SUB_ID
        obj.homework_id  = HW_ID
        obj.student_id   = STUDENT_ID
        obj.submitted_at = datetime.now(timezone.utc)
        obj.grade        = None
        obj.struggle_flag = False
        obj.teacher_feedback = None
        obj.analysis     = None

    db.refresh = mock_refresh

    app.dependency_overrides[get_current_user] = lambda: make_student()
    app.dependency_overrides[get_db] = lambda: db

    with TestClient(app) as client:
        resp = client.post(f"/homework/{HW_ID}/submit", json={"struggle_flag": False})

    app.dependency_overrides.clear()
    assert resp.status_code == 201
    assert resp.json()["struggle_flag"] is False


# ── Test: submit with struggle_flag=True → fire_alert is called ───────────────

def test_submit_with_struggle_fires_alert():
    hw = make_homework()

    db = AsyncMock()

    parent_user = make_parent()
    teacher_user = make_teacher()

    call_count = 0
    async def mock_execute(query):
        nonlocal call_count
        call_count += 1
        m = MagicMock()
        if call_count == 1:
            # First execute: Homework lookup
            m.scalar_one_or_none = MagicMock(return_value=hw)
        elif call_count == 2:
            # Second execute: Parent lookup
            m.scalar_one_or_none = MagicMock(return_value=parent_user)
        else:
            # Third execute: Teacher lookup
            m.scalar_one_or_none = MagicMock(return_value=teacher_user)
        return m

    db.execute = mock_execute

    async def mock_refresh(obj):
        obj.id            = SUB_ID
        obj.homework_id   = HW_ID
        obj.student_id    = STUDENT_ID
        obj.submitted_at  = datetime.now(timezone.utc)
        obj.grade         = None
        obj.struggle_flag = True
        obj.teacher_feedback = None
        obj.analysis      = None

    db.refresh = mock_refresh

    app.dependency_overrides[get_current_user] = lambda: make_student()
    app.dependency_overrides[get_db] = lambda: db

    fired = []

    async def mock_fire_alert(alert_type, payload):
        fired.append((alert_type, payload))

    with patch("app.routers.homework.fire_alert", side_effect=mock_fire_alert):
        with TestClient(app) as client:
            resp = client.post(f"/homework/{HW_ID}/submit", json={"struggle_flag": True})

    app.dependency_overrides.clear()
    assert resp.status_code == 201
    assert len(fired) == 1
    assert fired[0][0] == "struggle_detected"
    assert fired[0][1]["parent_email"] == "parent@test.com"


# ── Test: parent can't submit homework → 403 ──────────────────────────────────

def test_parent_cannot_submit_homework():
    db = AsyncMock()
    app.dependency_overrides[get_current_user] = lambda: make_parent()
    app.dependency_overrides[get_db] = lambda: db

    with TestClient(app) as client:
        resp = client.post(f"/homework/{HW_ID}/submit", json={"struggle_flag": False})

    app.dependency_overrides.clear()
    assert resp.status_code == 403


# ── Test: teacher views submissions → sees struggle flags ─────────────────────

def test_teacher_views_submissions_with_struggle_flags():
    hw = make_homework()
    sub = make_submission(struggle=True)

    db = AsyncMock()
    call_count = 0

    async def mock_execute(query):
        nonlocal call_count
        call_count += 1
        m = MagicMock()
        if call_count == 1:
            # Homework existence check
            m.scalar_one_or_none = MagicMock(return_value=hw)
        else:
            # Submissions list
            m.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[sub])))
        return m

    db.execute = mock_execute

    app.dependency_overrides[get_current_user] = lambda: make_teacher()
    app.dependency_overrides[get_db] = lambda: db

    with TestClient(app) as client:
        resp = client.get(f"/homework/{HW_ID}/submissions")

    app.dependency_overrides.clear()
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["struggle_flag"] is True


# ── Test: struggle analysis returns constructive text (mocked Groq) ───────────

def test_analyze_submission_returns_analysis():
    hw = make_homework()
    sub = make_submission()

    db = AsyncMock()
    call_count = 0

    async def mock_execute(query):
        nonlocal call_count
        call_count += 1
        m = MagicMock()
        if call_count == 1:
            m.scalar_one_or_none = MagicMock(return_value=sub)
        else:
            m.scalar_one_or_none = MagicMock(return_value=hw)
        return m

    db.execute = mock_execute

    async def mock_refresh(obj):
        pass

    db.refresh = mock_refresh

    mock_llm_response = MagicMock()
    mock_llm_response.content = "The student may benefit from extra practice with algebraic expressions."

    mock_llm = AsyncMock()
    mock_llm.ainvoke = AsyncMock(return_value=mock_llm_response)

    app.dependency_overrides[get_current_user] = lambda: make_teacher()
    app.dependency_overrides[get_db] = lambda: db

    with patch("app.routers.homework.get_llm", return_value=mock_llm):
        with TestClient(app) as client:
            resp = client.post(f"/homework/{HW_ID}/submissions/{SUB_ID}/analyze")

    app.dependency_overrides.clear()
    assert resp.status_code == 200
    data = resp.json()
    assert "analysis" in data
    assert "algebraic" in data["analysis"]
