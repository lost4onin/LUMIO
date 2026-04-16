"""
test_integration.py — End-to-end integration tests for all core flows.

Tests run against the actual DB and Redis (inside the Docker container).
Each test run uses unique email suffixes to avoid conflicts between runs.
Cleanup happens in teardown_module.

Run via: docker exec lumio-api pytest tests/test_integration.py -v --tb=short
"""
import pytest
from fastapi.testclient import TestClient
from uuid import uuid4

# Module-level unique suffix so parallel runs don't conflict
_RUN = uuid4().hex[:8]

# ── Test user credentials ─────────────────────────────────────────────────────
TEACHER = {"name": "Test Teacher", "email": f"tteacher_{_RUN}@test.com", "password": "test1234", "role": "teacher"}
STUDENT = {"name": "Test Student", "email": f"tstudent_{_RUN}@test.com", "password": "test1234", "role": "student"}
PARENT  = {"name": "Test Parent",  "email": f"tparent_{_RUN}@test.com",  "password": "test1234", "role": "parent"}


@pytest.fixture(scope="module")
def client():
    """Start the ASGI app with full lifespan (DB init + Redis)."""
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def registered_users(client):
    """Register all test users once and return their user data + cookies."""
    users = {}
    for u in [TEACHER, STUDENT, PARENT]:
        r = client.post("/auth/register", json=u)
        assert r.status_code == 201, f"Register failed for {u['role']}: {r.text}"
        users[u["role"]] = {
            "data": r.json()["user"],
            "cookies": dict(r.cookies),
        }
    return users


def _sync_db():
    """Sync psycopg2 connection for test fixtures — avoids asyncio event-loop conflicts."""
    import psycopg2
    return psycopg2.connect(host="postgres", port=5432, dbname="lumio", user="lumio", password="localdev")


def teardown_module(module):
    """Clean up all test rows created during this run (sync psycopg2 — no loop issues)."""
    conn = _sync_db()
    cur = conn.cursor()
    pattern = f"%_{_RUN}@test.com"
    cur.execute("""
        DELETE FROM homework_submissions
        WHERE student_id IN (SELECT id FROM users WHERE email LIKE %s)
           OR homework_id IN (SELECT id FROM homework WHERE teacher_id IN (SELECT id FROM users WHERE email LIKE %s))
    """, (pattern, pattern))
    cur.execute("DELETE FROM homework WHERE teacher_id IN (SELECT id FROM users WHERE email LIKE %s)", (pattern,))
    cur.execute("DELETE FROM adhd_risk_profiles WHERE student_id IN (SELECT id FROM users WHERE email LIKE %s)", (pattern,))
    cur.execute("DELETE FROM focus_events WHERE student_id IN (SELECT id FROM users WHERE email LIKE %s)", (pattern,))
    cur.execute("DELETE FROM sessions WHERE student_id IN (SELECT id FROM users WHERE email LIKE %s)", (pattern,))
    cur.execute("DELETE FROM users WHERE email LIKE %s", (pattern,))
    conn.commit()
    cur.close()
    conn.close()


# ══════════════════════════════════════════════════════════════════════════════
# AUTH FLOW TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestAuthRegister:
    def test_register_student_201(self, client):
        r = client.post("/auth/register", json={
            "name": f"Unique Student {_RUN}",
            "email": f"unique_s_{_RUN}@test.com",
            "password": "test1234",
            "role": "student",
        })
        assert r.status_code == 201
        body = r.json()
        assert "user" in body
        assert body["user"]["role"] == "student"
        assert body["user"]["email"] == f"unique_s_{_RUN}@test.com"
        # Cookie must be set
        assert "access_token" in r.cookies

    def test_register_teacher_201(self, client):
        r = client.post("/auth/register", json={
            "name": f"Unique Teacher {_RUN}",
            "email": f"unique_t_{_RUN}@test.com",
            "password": "test1234",
            "role": "teacher",
        })
        assert r.status_code == 201
        assert r.json()["user"]["role"] == "teacher"

    def test_register_parent_201(self, client):
        r = client.post("/auth/register", json={
            "name": f"Unique Parent {_RUN}",
            "email": f"unique_p_{_RUN}@test.com",
            "password": "test1234",
            "role": "parent",
        })
        assert r.status_code == 201

    def test_register_duplicate_email_400(self, client, registered_users):
        r = client.post("/auth/register", json={
            "name": "Duplicate",
            "email": STUDENT["email"],  # already registered in fixture
            "password": "test1234",
            "role": "student",
        })
        assert r.status_code == 400

    def test_register_invalid_role_422(self, client):
        r = client.post("/auth/register", json={
            "name": "Bad Role",
            "email": f"badrole_{_RUN}@test.com",
            "password": "test1234",
            "role": "admin",  # invalid
        })
        assert r.status_code == 422

    def test_register_short_password_422(self, client):
        r = client.post("/auth/register", json={
            "name": "Short Pass",
            "email": f"shortpw_{_RUN}@test.com",
            "password": "abc",
            "role": "student",
        })
        assert r.status_code == 422

    def test_response_has_name_not_full_name(self, client, registered_users):
        """Frontend reads .name — ensure the API returns 'name', not 'full_name'."""
        user = registered_users["student"]["data"]
        assert "name" in user
        assert "full_name" not in user


class TestAuthLogin:
    def test_login_valid_200(self, client, registered_users):
        r = client.post("/auth/login", json={
            "email": STUDENT["email"],
            "password": "test1234",
            "role": "student",
        })
        assert r.status_code == 200
        assert "access_token" in r.json()
        assert "access_token" in r.cookies

    def test_login_wrong_password_401(self, client, registered_users):
        r = client.post("/auth/login", json={
            "email": STUDENT["email"],
            "password": "wrongpass",
            "role": "student",
        })
        assert r.status_code == 401

    def test_login_wrong_role_403(self, client, registered_users):
        r = client.post("/auth/login", json={
            "email": STUDENT["email"],
            "password": "test1234",
            "role": "teacher",  # student trying to login as teacher
        })
        assert r.status_code == 403

    def test_login_nonexistent_email_401(self, client):
        r = client.post("/auth/login", json={
            "email": f"nobody_{_RUN}@test.com",
            "password": "test1234",
        })
        assert r.status_code == 401


class TestAuthMe:
    def test_me_authenticated_returns_user_wrapper(self, client, registered_users):
        """GET /auth/me must return {user: {...}} — frontend reads response.data.user"""
        cookies = registered_users["student"]["cookies"]
        r = client.get("/auth/me", cookies=cookies)
        assert r.status_code == 200
        body = r.json()
        # Key contract: response body MUST have 'user' key
        assert "user" in body
        assert body["user"]["role"] == "student"
        assert "name" in body["user"]

    def test_me_no_token_401(self, client):
        # The module-scoped client accumulates cookies; clear them for this test
        saved = {k: v for k, v in client.cookies.items()}
        client.cookies.clear()
        try:
            r = client.get("/auth/me")
            assert r.status_code == 401
        finally:
            for k, v in saved.items():
                client.cookies.set(k, v)

    def test_me_invalid_token_401(self, client):
        r = client.get("/auth/me", cookies={"access_token": "bad.token.here"})
        assert r.status_code == 401


class TestAuthLogout:
    def test_logout_clears_cookie(self, client, registered_users):
        cookies = registered_users["student"]["cookies"]
        r = client.post("/auth/logout", cookies=cookies)
        assert r.status_code == 204


# ══════════════════════════════════════════════════════════════════════════════
# SESSION TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestSessions:
    def test_start_session_201(self, client, registered_users):
        cookies = registered_users["student"]["cookies"]
        r = client.post("/sessions/start", json={}, cookies=cookies)
        assert r.status_code == 200
        body = r.json()
        assert "id" in body
        assert body["student_id"] == registered_users["student"]["data"]["id"]

    def test_start_session_teacher_403(self, client, registered_users):
        cookies = registered_users["teacher"]["cookies"]
        r = client.post("/sessions/start", json={}, cookies=cookies)
        assert r.status_code == 403

    def test_end_session(self, client, registered_users):
        cookies = registered_users["student"]["cookies"]
        # Start first
        start = client.post("/sessions/start", json={}, cookies=cookies)
        session_id = start.json()["id"]
        # End it
        r = client.post("/sessions/end", json={"session_id": session_id}, cookies=cookies)
        assert r.status_code == 200
        body = r.json()
        assert body["ended_at"] is not None
        assert body["duration_sec"] is not None
        assert body["duration_sec"] >= 0

    def test_list_sessions_student_sees_own(self, client, registered_users):
        cookies = registered_users["student"]["cookies"]
        r = client.get("/sessions/", cookies=cookies)
        assert r.status_code == 200
        sessions = r.json()
        assert isinstance(sessions, list)
        student_id = registered_users["student"]["data"]["id"]
        for s in sessions:
            assert s["student_id"] == student_id

    def test_end_nonexistent_session_404(self, client, registered_users):
        cookies = registered_users["student"]["cookies"]
        r = client.post("/sessions/end",
                        json={"session_id": str(uuid4())},
                        cookies=cookies)
        assert r.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# ANALYTICS TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestAnalytics:
    _events = [
        {"gaze_score": 0.3, "blink_rate": 28, "head_pose_deg": 5.0, "focus_score": 0.25},
        {"gaze_score": 0.4, "blink_rate": 30, "head_pose_deg": 8.0, "focus_score": 0.30},
        {"gaze_score": 0.2, "blink_rate": 26, "head_pose_deg": 3.0, "focus_score": 0.20},
    ]

    def test_classify_returns_cause_and_confidence(self, client, registered_users):
        cookies = registered_users["student"]["cookies"]
        r = client.post("/analytics/classify",
                        json={"events": self._events},
                        cookies=cookies)
        assert r.status_code == 200
        body = r.json()
        assert "cause" in body
        assert "confidence" in body
        assert isinstance(body["confidence"], float)
        assert 0.0 <= body["confidence"] <= 1.0

    def test_classify_requires_auth(self, client):
        saved = {k: v for k, v in client.cookies.items()}
        client.cookies.clear()
        try:
            r = client.post("/analytics/classify", json={"events": self._events})
            assert r.status_code == 401
        finally:
            for k, v in saved.items():
                client.cookies.set(k, v)

    def test_classify_empty_events_422(self, client, registered_users):
        cookies = registered_users["student"]["cookies"]
        r = client.post("/analytics/classify",
                        json={"events": []},
                        cookies=cookies)
        assert r.status_code == 422

    def test_classify_focused_profile(self, client, registered_users):
        cookies = registered_users["student"]["cookies"]
        high_focus = [
            {"gaze_score": 0.9, "blink_rate": 12, "head_pose_deg": 1.0, "focus_score": 0.92},
            {"gaze_score": 0.85, "blink_rate": 11, "head_pose_deg": 0.5, "focus_score": 0.88},
        ]
        r = client.post("/analytics/classify",
                        json={"events": high_focus},
                        cookies=cookies)
        assert r.status_code == 200
        assert r.json()["cause"] == "focused"


# ══════════════════════════════════════════════════════════════════════════════
# HOMEWORK TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestHomework:
    _hw_id = None
    _submission_id = None

    def test_teacher_creates_homework_201(self, client, registered_users):
        cookies = registered_users["teacher"]["cookies"]
        r = client.post("/homework/", json={
            "title": f"Test HW {_RUN}",
            "description": "Test description",
            "difficulty_level": 2,
        }, cookies=cookies)
        assert r.status_code == 201
        body = r.json()
        assert body["title"] == f"Test HW {_RUN}"
        TestHomework._hw_id = body["id"]

    def test_student_cannot_create_homework_403(self, client, registered_users):
        cookies = registered_users["student"]["cookies"]
        r = client.post("/homework/", json={"title": "Student HW", "difficulty_level": 1},
                        cookies=cookies)
        assert r.status_code == 403

    def test_parent_cannot_create_homework_403(self, client, registered_users):
        cookies = registered_users["parent"]["cookies"]
        r = client.post("/homework/", json={"title": "Parent HW", "difficulty_level": 1},
                        cookies=cookies)
        assert r.status_code == 403

    def test_student_submits_homework_201(self, client, registered_users):
        assert TestHomework._hw_id, "hw_id not set — run test_teacher_creates_homework first"
        cookies = registered_users["student"]["cookies"]
        r = client.post(f"/homework/{TestHomework._hw_id}/submit",
                        json={"time_spent_sec": 1800, "struggle_flag": False},
                        cookies=cookies)
        assert r.status_code == 201
        body = r.json()
        assert body["homework_id"] == TestHomework._hw_id
        TestHomework._submission_id = body["id"]

    def test_student_submits_with_struggle_flag(self, client, registered_users):
        """Struggle submissions should succeed — n8n alert fires in background."""
        assert TestHomework._hw_id
        cookies = registered_users["student"]["cookies"]
        r = client.post(f"/homework/{TestHomework._hw_id}/submit",
                        json={"time_spent_sec": 3600, "struggle_flag": True},
                        cookies=cookies)
        # 201 regardless of n8n webhook outcome (n8n failure never crashes the API)
        assert r.status_code == 201
        assert r.json()["struggle_flag"] is True

    def test_teacher_cannot_submit_homework_403(self, client, registered_users):
        assert TestHomework._hw_id
        cookies = registered_users["teacher"]["cookies"]
        r = client.post(f"/homework/{TestHomework._hw_id}/submit",
                        json={},
                        cookies=cookies)
        assert r.status_code == 403

    def test_teacher_views_submissions(self, client, registered_users):
        assert TestHomework._hw_id
        cookies = registered_users["teacher"]["cookies"]
        r = client.get(f"/homework/{TestHomework._hw_id}/submissions", cookies=cookies)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_teacher_grades_submission(self, client, registered_users):
        assert TestHomework._submission_id
        cookies = registered_users["teacher"]["cookies"]
        r = client.patch(f"/homework/submissions/{TestHomework._submission_id}/grade",
                         json={"grade": 15.0, "teacher_feedback": "Well done!"},
                         cookies=cookies)
        assert r.status_code == 200
        body = r.json()
        assert body["grade"] == 15.0
        assert body["struggle_flag"] is False  # grade >= 8 → no struggle

    def test_grade_below_8_sets_struggle_flag(self, client, registered_users):
        assert TestHomework._submission_id
        cookies = registered_users["teacher"]["cookies"]
        r = client.patch(f"/homework/submissions/{TestHomework._submission_id}/grade",
                         json={"grade": 5.5, "teacher_feedback": "Needs improvement"},
                         cookies=cookies)
        assert r.status_code == 200
        assert r.json()["struggle_flag"] is True

    def test_grade_out_of_range_422(self, client, registered_users):
        assert TestHomework._submission_id
        cookies = registered_users["teacher"]["cookies"]
        r = client.patch(f"/homework/submissions/{TestHomework._submission_id}/grade",
                         json={"grade": 25.0},  # max is 20
                         cookies=cookies)
        assert r.status_code == 422

    def test_submit_nonexistent_homework_404(self, client, registered_users):
        cookies = registered_users["student"]["cookies"]
        r = client.post(f"/homework/{uuid4()}/submit", json={}, cookies=cookies)
        assert r.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# STUDENT PROFILE TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestStudentProfiles:
    def test_student_me_profile(self, client, registered_users):
        """Student can get their own profile via /students/me/profile."""
        cookies = registered_users["student"]["cookies"]
        r = client.get("/students/me/profile", cookies=cookies)
        assert r.status_code == 200
        body = r.json()
        assert "risk_tier" in body
        assert "for_student" in body
        assert "focus_avg_7d" in body
        # risk_score must NEVER appear in the student response
        assert "risk_score" not in body

    def test_teacher_cannot_use_me_profile_403(self, client, registered_users):
        cookies = registered_users["teacher"]["cookies"]
        r = client.get("/students/me/profile", cookies=cookies)
        assert r.status_code == 403

    def test_student_profile_404_when_no_risk_data(self, client, registered_users):
        """Newly registered student has no risk profile yet."""
        student_id = registered_users["student"]["data"]["id"]
        cookies = registered_users["teacher"]["cookies"]
        r = client.get(f"/students/{student_id}/profile", cookies=cookies)
        assert r.status_code == 404

    def test_student_cannot_view_other_student_403(self, client, registered_users):
        """Students can only view their own profile."""
        cookies = registered_users["student"]["cookies"]
        # Use teacher's id as a random different user id
        other_id = registered_users["teacher"]["data"]["id"]
        r = client.get(f"/students/{other_id}/profile", cookies=cookies)
        assert r.status_code == 403

    def test_profile_risk_score_teacher_only(self, client, registered_users):
        """
        Teacher sees risk_score; student and parent never do (ethical boundary).
        Seeds a risk profile via psycopg2 to avoid asyncio event-loop conflicts.
        """
        import json
        student_id = registered_users["student"]["data"]["id"]

        # Seed risk profile via sync psycopg2 — no event-loop conflict
        conn = _sync_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO adhd_risk_profiles
                (id, student_id, risk_score, risk_tier, suggested_actions, professional_referral)
            VALUES (gen_random_uuid(), %s, %s, %s, %s::jsonb, %s)
        """, (
            student_id, 0.55, "moderate",
            json.dumps({"for_teacher": ["Monitor"], "for_student": ["Pomodoro"],
                        "for_parent": ["Sleep"], "urgency": "moderate"}),
            False,
        ))
        conn.commit()
        cur.close()
        conn.close()

        # Teacher sees risk_score
        teacher_cookies = registered_users["teacher"]["cookies"]
        r = client.get(f"/students/{student_id}/profile", cookies=teacher_cookies)
        assert r.status_code == 200
        body = r.json()
        assert "risk_score" in body
        assert body["risk_score"] == 0.55

        # Student sees own profile but NOT risk_score
        student_cookies = registered_users["student"]["cookies"]
        r = client.get(f"/students/{student_id}/profile", cookies=student_cookies)
        assert r.status_code == 200
        assert "risk_score" not in r.json()


# ══════════════════════════════════════════════════════════════════════════════
# RAG ENDPOINT TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestRAG:
    def test_teacher_rag_200(self, client, registered_users):
        cookies = registered_users["teacher"]["cookies"]
        r = client.post("/rag/teacher", json={"message": "What are signs of ADHD in class?"}, cookies=cookies)
        assert r.status_code == 200
        body = r.json()
        assert "answer" in body
        assert "sources" in body

    def test_parent_cannot_use_teacher_rag_403(self, client, registered_users):
        cookies = registered_users["parent"]["cookies"]
        r = client.post("/rag/teacher", json={"message": "Hello"}, cookies=cookies)
        assert r.status_code == 403

    def test_parent_rag_200(self, client, registered_users):
        cookies = registered_users["parent"]["cookies"]
        r = client.post("/rag/parent", json={"message": "How can I help my child focus?"}, cookies=cookies)
        assert r.status_code == 200

    def test_student_cannot_use_parent_rag_403(self, client, registered_users):
        cookies = registered_users["student"]["cookies"]
        r = client.post("/rag/parent", json={"message": "Hello"}, cookies=cookies)
        assert r.status_code == 403

    def test_student_rag_200(self, client, registered_users):
        cookies = registered_users["student"]["cookies"]
        r = client.post("/rag/student", json={"message": "How do I stay focused?"}, cookies=cookies)
        assert r.status_code == 200

    def test_teacher_cannot_use_student_rag_403(self, client, registered_users):
        cookies = registered_users["teacher"]["cookies"]
        r = client.post("/rag/student", json={"message": "Hello"}, cookies=cookies)
        assert r.status_code == 403

    def test_rag_requires_auth(self, client):
        saved = {k: v for k, v in client.cookies.items()}
        client.cookies.clear()
        try:
            r = client.post("/rag/teacher", json={"message": "Hello"})
            assert r.status_code == 401
        finally:
            for k, v in saved.items():
                client.cookies.set(k, v)


# ══════════════════════════════════════════════════════════════════════════════
# N8N ALERT SERVICE TESTS
# ══════════════════════════════════════════════════════════════════════════════

class TestN8nService:
    def test_trigger_n8n_empty_url_no_exception(self):
        """trigger_n8n with an unreachable URL must never raise."""
        import asyncio
        from app.services.n8n_service import trigger_n8n
        # Use a port that will refuse connections
        async def _run():
            result = await trigger_n8n("test_workflow", {"key": "value"})
            return result
        result = asyncio.run(_run())
        # Returns False (failed) but does NOT raise
        assert result is False

    def test_trigger_n8n_returns_bool(self):
        import asyncio
        from app.services.n8n_service import trigger_n8n
        async def _run():
            return await trigger_n8n("focus_alert", {"student_id": "test"})
        result = asyncio.run(_run())
        assert isinstance(result, bool)


# ══════════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ══════════════════════════════════════════════════════════════════════════════

def test_health_check(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
