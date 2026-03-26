# LUMIO — Day 2 Summary

## What Was Built

### 1. `backend/app/schemas/` folder

Created the schemas package — separates API data validation (Pydantic) from database models (SQLAlchemy).

**Files created:**
- `backend/app/schemas/__init__.py` — empty, marks folder as a Python package
- `backend/app/schemas/user.py` — 4 Pydantic v2 schemas

**Schemas in `user.py`:**

| Schema | Purpose | Key fields |
|--------|---------|------------|
| `UserCreate` | Validates POST /register body | full_name (2-255 chars), email (EmailStr), password (min 6), role (student/teacher/parent only) |
| `UserLogin` | Validates POST /login body | email, password |
| `UserResponse` | Shapes API responses | id, full_name, email, role, language_pref, xp_points, streak_days, created_at — no hashed_password |
| `Token` | Returned after auth | access_token, token_type="bearer", user: UserResponse |

**Key Pydantic v2 concepts used:**
- `Field(..., min_length=2)` — required field with validation
- `EmailStr` — validates email format (needs `email-validator` package)
- `pattern="^(student|teacher|parent)$"` — regex constraint on role
- `model_config = {"from_attributes": True}` — lets Pydantic read SQLAlchemy ORM objects

---

### 2. `backend/app/routers/auth.py` — Full Implementation

Replaced the Day 1 stub with a complete authentication system.

**Endpoints:**

#### `POST /auth/register`
1. Check if email already exists → 400 "Email already registered"
2. Hash password with bcrypt via `passlib.CryptContext`
3. Insert new `User` row into PostgreSQL (async)
4. Create JWT token (`sub`=user UUID, `role`, `exp`)
5. Set JWT as httpOnly cookie named `access_token`
6. Return `Token` schema

#### `POST /auth/login`
1. Find user by email → 401 "Invalid credentials" if not found
2. Verify bcrypt hash → same 401 if wrong (same message prevents user enumeration)
3. Create JWT + set cookie
4. Return `Token` schema

#### `GET /auth/me` (protected)
- Injects `get_current_user` dependency
- Returns `UserResponse` of the authenticated user

**Helper functions:**

```python
def create_access_token(data: dict) -> str:
    # signs JWT with settings.JWT_SECRET_KEY
    # adds exp = now + JWT_EXPIRE_MINUTES
    # returns signed string

def set_auth_cookie(response: Response, token: str) -> None:
    # httponly=True  → JavaScript cannot read it (XSS protection)
    # samesite="lax" → sent for same-site + top-level navigations
    # secure=False   → allow HTTP in local dev (set True in production)
    # max_age        → cookie lifetime matches token expiry

async def get_current_user(request, db) -> User:
    # reads "access_token" cookie
    # decodes JWT with python-jose
    # fetches user from DB
    # raises 401 if anything fails
    # used as Depends() in any protected route
```

**Security decisions:**
- JWT in httpOnly cookie, never in response body or Authorization header
- Same error for wrong email and wrong password (prevents user enumeration)
- All DB calls are `async/await` — no synchronous SQLAlchemy
- bcrypt is intentionally slow — makes brute-force impractical

---

### 3. `backend/requirements.txt` — Two additions

```
email-validator==2.2.0   # required for Pydantic EmailStr
bcrypt==3.2.2            # pinned — see bug fix below
```

---

## Bugs Fixed During Testing

### Bug 1: `email-validator` not installed in Docker image
- **Cause:** `email-validator` was added to `requirements.txt` after the Docker image was built. The running container did not have it, so `pydantic.EmailStr` raised an `ImportError` at startup.
- **Fix:** Installed directly into the running container with `docker exec lumio-api pip install email-validator==2.2.0`. Also pinned in `requirements.txt` for the next full rebuild.

### Bug 2: `bcrypt 5.0.0` incompatible with `passlib 1.7.4`
- **Cause:** bcrypt 4.0+ enforces a 72-byte password limit. `passlib 1.7.4` runs a backend detection test internally using a password longer than 72 bytes — this triggers a `ValueError` in newer bcrypt, crashing the server on startup.
- **Fix:** Downgraded bcrypt to `3.2.2` (the last version without the 72-byte enforcement). Updated `requirements.txt` to pin `bcrypt==3.2.2` so the next `docker-compose build` produces a correct image.

---

## Test Results — All 11 Passed

| # | Test | Status | Response |
|---|------|--------|----------|
| 1 | Docker — 4 containers running | PASS | lumio-api :8000, lumio-postgres :5432, lumio-redis :6379, lumio-n8n :5678 |
| 2 | `GET /` health check | PASS | `{"status":"ok","service":"Lumio API","version":"0.1.0"}` |
| 3 | Database — 6 tables | PASS | users, sessions, focus_events, homework, homework_submissions, adhd_risk_profiles |
| 4 | `POST /auth/register` | PASS | 200, body has access_token + user object, access_token cookie set |
| 5 | Duplicate email | PASS | 400 `"Email already registered"` |
| 6 | `POST /auth/login` correct password | PASS | 200, user data returned, cookie refreshed |
| 7 | `POST /auth/login` wrong password | PASS | 401 `"Invalid credentials"` |
| 8 | `GET /auth/me` with cookie | PASS | 200, `full_name: Test Teacher, role: teacher` |
| 9 | `GET /auth/me` without cookie | PASS | 401 `"Not authenticated"` |
| 10 | User saved in database | PASS | UUID, full_name, email, role, created_at all present |
| 11 | Register student + parent | PASS | 3 rows in DB: teacher / student / parent |

---

## Database State After Day 2

```
  full_name   |       email       |  role
--------------+-------------------+---------
 Test Teacher | teacher@lumio.com | teacher
 Test Student | student@lumio.com | student
 Test Parent  | parent@lumio.com  | parent
```

---

## Files Changed on Day 2

```
backend/
├── app/
│   ├── schemas/
│   │   ├── __init__.py          ← NEW (empty)
│   │   └── user.py              ← NEW (UserCreate, UserLogin, UserResponse, Token)
│   └── routers/
│       └── auth.py              ← REPLACED stub with full implementation
└── requirements.txt             ← ADDED email-validator==2.2.0, bcrypt==3.2.2
```

---

## What Day 3 Will Build

- WebSocket endpoint for real-time focus score streaming
- Redis integration to store focus events
- `POST /sessions/start` and `POST /sessions/end`
- Live teacher dashboard feed
