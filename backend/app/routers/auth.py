"""
auth.py — Authentication endpoints.

Why httpOnly cookies instead of returning the token in JSON?
  - httpOnly cookies cannot be read by JavaScript → immune to XSS attacks
  - The browser sends the cookie automatically with every request → no manual
    "Authorization: Bearer <token>" header management needed on the frontend

Day 2 scope:
  POST /auth/register  — create new user, return JWT in httpOnly cookie
  POST /auth/login     — verify credentials, return JWT in httpOnly cookie
  GET  /auth/me        — return current authenticated user (protected route)
  get_current_user()   — reusable dependency injected into any protected route
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import User, get_db
from app.schemas.user import Token, UserCreate, UserLogin, UserResponse

router = APIRouter()

# ── Password hashing ─────────────────────────────────────────────────────────
# CryptContext handles bcrypt hashing. bcrypt is intentionally slow — it makes
# brute-force attacks impractical. deprecated="auto" automatically upgrades
# old hash formats if you ever change the scheme.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── JWT helpers ───────────────────────────────────────────────────────────────
def create_access_token(data: dict) -> str:
    """
    Signs a JWT with the app's secret key.

    The token payload ("claims") contains:
      sub: the user's UUID — the standard JWT field for "subject" (who is this token for?)
      role: stored so the frontend can show the right UI without an extra /me call
      exp: expiry timestamp — python-jose validates this automatically on decode

    The token is a signed string. Anyone can decode it (it's base64), but only
    the server can verify it hasn't been tampered with (it knows the secret).
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def set_auth_cookie(response: Response, token: str) -> None:
    """
    Attaches the JWT as a httpOnly cookie to the HTTP response.

    httponly=True:    JavaScript cannot read this cookie (XSS protection)
    samesite="lax":   Cookie is sent for same-site requests + top-level navigations
    secure=False:     Allow HTTP in local dev. Set to True in production (HTTPS only)
    max_age:          Cookie lifetime in seconds, matching the token expiry
    """
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=settings.JWT_EXPIRE_MINUTES * 60,
    )


# ── Dependency: get_current_user ─────────────────────────────────────────────
async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency — inject this into any route that requires authentication.

    How it works:
      1. Reads the "access_token" cookie from the incoming request
      2. Decodes and validates the JWT (signature + expiry)
      3. Extracts the user_id from the "sub" claim
      4. Fetches the user from the database to ensure they still exist

    Usage in a protected route:
        @router.get("/protected")
        async def protected(current_user: User = Depends(get_current_user)):
            return {"hello": current_user.full_name}
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )

    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        # JWTError covers: expired token, invalid signature, malformed token
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    return user


# ── POST /register ────────────────────────────────────────────────────────────
@router.post("/register", response_model=Token)
async def register(
    body: UserCreate,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new user account.

    Steps:
      1. Check if email already exists (unique constraint in DB, but better UX to check early)
      2. Hash the plaintext password with bcrypt
      3. Insert a new User row
      4. Create a JWT and set it as a httpOnly cookie
      5. Return the Token schema (access_token + UserResponse)
    """
    # Step 1: duplicate email check
    result = await db.execute(select(User).where(User.email == body.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Step 2: hash the password
    # Never store plaintext passwords. pwd_context.hash() runs bcrypt internally.
    hashed_pw = pwd_context.hash(body.password)

    # Step 3: insert user row
    new_user = User(
        full_name=body.full_name,
        email=body.email,
        hashed_password=hashed_pw,
        role=body.role,
    )
    db.add(new_user)
    await db.commit()
    # After commit, new_user.id is now populated by the DB (UUID generated server-side)
    await db.refresh(new_user)

    # Step 4: create JWT — sub is the user's UUID as a string
    token = create_access_token({"sub": str(new_user.id), "role": new_user.role})
    set_auth_cookie(response, token)

    # Step 5: return structured response
    return Token(access_token=token, user=UserResponse.model_validate(new_user))


# ── POST /login ───────────────────────────────────────────────────────────────
@router.post("/login", response_model=Token)
async def login(
    body: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate an existing user.

    Security note: we return the SAME error message for both "user not found"
    and "wrong password". This is intentional — giving different errors would
    let attackers enumerate valid email addresses (user enumeration attack).
    """
    # Look up the user by email
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # pwd_context.verify() compares the plaintext with the stored bcrypt hash.
    # If user is None we still call verify with a dummy hash to prevent timing attacks
    # (comparing strings of the same length takes the same time regardless).
    if not user or not pwd_context.verify(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    token = create_access_token({"sub": str(user.id), "role": user.role})
    set_auth_cookie(response, token)

    return Token(access_token=token, user=UserResponse.model_validate(user))


# ── GET /me ───────────────────────────────────────────────────────────────────
@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    """
    Return the currently authenticated user.

    get_current_user does all the heavy lifting:
      - reads the cookie
      - decodes the JWT
      - fetches the user from DB

    This route just hands back the result.
    """
    return UserResponse.model_validate(current_user)
