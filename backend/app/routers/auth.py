"""
auth.py — Authentication endpoints.

Why httpOnly cookies instead of returning the token in JSON?
  - httpOnly cookies cannot be read by JavaScript → immune to XSS attacks
  - The browser sends the cookie automatically with every request → no manual
    "Authorization: Bearer <token>" header management needed on the frontend
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import User, get_db
from app.schemas.user import Token, UserCreate, UserLogin, UserResponse, UserWrapper

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=settings.JWT_EXPIRE_MINUTES * 60,
    )


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency — inject into any route that requires authentication.
    Reads the httpOnly cookie, decodes the JWT, fetches the user from DB.
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
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    return user


@router.post(
    "/register",
    response_model=Token,
    status_code=201,
    summary="Register a new user",
    description="Creates a student, teacher, or parent account. Sets a JWT httpOnly cookie.",
    tags=["Auth"],
)
async def register(
    body: UserCreate,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    hashed_pw = pwd_context.hash(body.password)
    new_user = User(
        full_name=body.name,   # API uses 'name', DB column is full_name
        email=body.email,
        hashed_password=hashed_pw,
        role=body.role,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    token = create_access_token({"sub": str(new_user.id), "role": new_user.role})
    set_auth_cookie(response, token)
    return Token(access_token=token, user=UserResponse.model_validate(new_user))


@router.post(
    "/login",
    response_model=Token,
    summary="Login",
    description="Authenticate with email + password. Optionally validates role matches.",
    tags=["Auth"],
)
async def login(
    body: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # Same error for "not found" and "wrong password" — prevents user enumeration
    if not user or not pwd_context.verify(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Verify role matches the login form selection
    if body.role and user.role != body.role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Wrong role selected",
        )

    token = create_access_token({"sub": str(user.id), "role": user.role})
    set_auth_cookie(response, token)
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.get(
    "/me",
    response_model=UserWrapper,
    summary="Get current user",
    description="Returns the authenticated user. Frontend reads response.data.user",
    tags=["Auth"],
)
async def me(current_user: User = Depends(get_current_user)):
    return UserWrapper(user=UserResponse.model_validate(current_user))


@router.post(
    "/logout",
    status_code=204,
    summary="Logout",
    description="Clears the httpOnly auth cookie.",
    tags=["Auth"],
)
async def logout(response: Response):
    response.delete_cookie(key="access_token", samesite="lax")
