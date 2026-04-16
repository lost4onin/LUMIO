"""
test_demo.py — Linking smoke tests for the LUMIO demo.

Walks the critical frontend → backend paths end-to-end:
  register → login → me → rag (3 roles) → session start → homework list

Uses psycopg2 (host="postgres") for cleanup, mirroring test_integration.py.
Run:
  docker exec lumio-api pytest tests/test_demo.py -v --tb=short
"""
import pytest
import psycopg2
from uuid import uuid4
from fastapi.testclient import TestClient


_RUN = uuid4().hex[:8]

TEACHER = {
    "name": f"Demo Teacher {_RUN}",
    "email": f"demo_teacher_{_RUN}@test.com",
    "password": "test1234",
    "role": "teacher",
}
STUDENT = {
    "name": f"Demo Student {_RUN}",
    "email": f"demo_student_{_RUN}@test.com",
    "password": "test1234",
    "role": "student",
}
PARENT = {
    "name": f"Demo Parent {_RUN}",
    "email": f"demo_parent_{_RUN}@test.com",
    "password": "test1234",
    "role": "parent",
}


def _sync_db():
    return psycopg2.connect(
        host="postgres", port=5432,
        dbname="lumio", user="lumio", password="localdev",
    )


@pytest.fixture(scope="module")
def client():
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def users(client):
    """Register all three demo users once and return their cookies + ids."""
    out = {}
    for u in (TEACHER, STUDENT, PARENT):
        r = client.post("/auth/register", json=u)
        assert r.status_code == 201, f"register {u['role']} failed: {r.text}"
        out[u["role"]] = {
            "cookies": dict(r.cookies),
            "data": r.json()["user"],
        }
    return out


def teardown_module(module):
    conn = _sync_db()
    cur = conn.cursor()
    pattern = f"%_{_RUN}@test.com"
    cur.execute(
        "DELETE FROM homework_submissions WHERE student_id IN "
        "(SELECT id FROM users WHERE email LIKE %s)",
        (pattern,),
    )
    cur.execute(
        "DELETE FROM adhd_risk_profiles WHERE student_id IN "
        "(SELECT id FROM users WHERE email LIKE %s)",
        (pattern,),
    )
    cur.execute(
        "DELETE FROM focus_events WHERE student_id IN "
        "(SELECT id FROM users WHERE email LIKE %s)",
        (pattern,),
    )
    cur.execute(
        "DELETE FROM sessions WHERE student_id IN "
        "(SELECT id FROM users WHERE email LIKE %s)",
        (pattern,),
    )
    cur.execute("DELETE FROM users WHERE email LIKE %s", (pattern,))
    conn.commit()
    cur.close()
    conn.close()


# ── 1. /auth/register ────────────────────────────────────────────────────────
def test_register(client):
    r = client.post("/auth/register", json={
        "name": f"Reg User {_RUN}",
        "email": f"reg_{_RUN}@test.com",
        "password": "test1234",
        "role": "student",
    })
    assert r.status_code == 201
    assert "user" in r.json()


# ── 2. /auth/login ───────────────────────────────────────────────────────────
def test_login(client, users):
    r = client.post("/auth/login", json={
        "email": STUDENT["email"],
        "password": STUDENT["password"],
        "role": STUDENT["role"],
    })
    assert r.status_code == 200
    assert "access_token" in r.cookies


# ── 3. /auth/me ──────────────────────────────────────────────────────────────
def test_me(client, users):
    cookies = users["student"]["cookies"]
    r = client.get("/auth/me", cookies=cookies)
    assert r.status_code == 200
    body = r.json()
    assert "user" in body
    assert body["user"]["role"] == "student"


# ── 4. /rag/teacher ──────────────────────────────────────────────────────────
def test_rag_teacher(client, users):
    cookies = users["teacher"]["cookies"]
    r = client.post(
        "/rag/teacher",
        json={"message": "How can I help a distracted student?"},
        cookies=cookies,
    )
    assert r.status_code == 200
    body = r.json()
    assert "answer" in body
    assert isinstance(body["answer"], str) and len(body["answer"]) > 0


# ── 5. /rag/parent ───────────────────────────────────────────────────────────
def test_rag_parent(client, users):
    cookies = users["parent"]["cookies"]
    r = client.post(
        "/rag/parent",
        json={"message": "How do I support my child with focus issues?"},
        cookies=cookies,
    )
    assert r.status_code == 200
    body = r.json()
    assert "answer" in body
    assert isinstance(body["answer"], str) and len(body["answer"]) > 0
    # Ethical boundary: parent payload must never include risk_score
    assert "risk_score" not in body


# ── 6. /rag/student ──────────────────────────────────────────────────────────
def test_rag_student(client, users):
    cookies = users["student"]["cookies"]
    r = client.post(
        "/rag/student",
        json={"message": "How do I stay focused while studying?"},
        cookies=cookies,
    )
    assert r.status_code == 200
    body = r.json()
    assert "answer" in body
    assert isinstance(body["answer"], str) and len(body["answer"]) > 0


# ── 7. /sessions/start ───────────────────────────────────────────────────────
def test_session_start(client, users):
    cookies = users["student"]["cookies"]
    r = client.post(
        "/sessions/start",
        json={"student_id": users["student"]["data"]["id"], "subject": "Math"},
        cookies=cookies,
    )
    assert r.status_code == 201
    body = r.json()
    assert "session_id" in body


# ── 8. /homework/{class_id} ──────────────────────────────────────────────────
def test_homework_list(client, users):
    cookies = users["teacher"]["cookies"]
    r = client.get("/homework/class-001", cookies=cookies)
    assert r.status_code == 200
    body = r.json()
    assert "assignments" in body
    assert isinstance(body["assignments"], list)
