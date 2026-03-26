"""
user.py — Pydantic v2 schemas for the users resource.

Schemas are NOT the same as database models (SQLAlchemy).
They define:
  - What data the API *accepts* (request bodies) — UserCreate, UserLogin
  - What data the API *returns* (response bodies) — UserResponse, Token

Pydantic validates data automatically. If a request sends an invalid email
or a password shorter than 6 chars, Pydantic raises a 422 error before
your route function even runs.
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class UserCreate(BaseModel):
    """
    Accepted body for POST /auth/register.
    Field(...) means the field is required — no default value.
    min_length / max_length / pattern are validated automatically.
    """
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr                                    # validates format: user@domain.tld
    password: str = Field(..., min_length=6)
    role: str = Field(..., pattern="^(student|teacher|parent)$")  # only these 3 values


class UserLogin(BaseModel):
    """Accepted body for POST /auth/login."""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """
    Returned in API responses. Notice: no hashed_password field — never expose it.
    model_config from_attributes=True tells Pydantic to read data from SQLAlchemy
    ORM objects (which have attributes) rather than dicts.
    """
    id: UUID
    full_name: str
    email: str
    role: str
    language_pref: str
    xp_points: int
    streak_days: int
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    """
    Returned after successful login/register.
    access_token is also set in a httpOnly cookie — the body field is kept
    for future use by native mobile clients that can't use cookies.
    """
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
