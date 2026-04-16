"""
user.py — Pydantic v2 schemas for the users resource.

Key design: The DB stores full_name but the API surface uses name
to match the frontend User interface. UserResponse.map_full_name
handles the conversion transparently.
"""
from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import Optional
from uuid import UUID
from datetime import datetime


class UserCreate(BaseModel):
    # Frontend sends 'name', DB stores it as full_name — mapped in the router
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: str = Field(..., pattern="^(student|teacher|parent)$")


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    # Frontend sends role for UI validation; backend enforces it
    role: Optional[str] = None


class UserResponse(BaseModel):
    id: UUID
    name: str
    email: str
    role: str
    language_pref: str
    xp_points: int
    streak_days: int
    created_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def map_full_name(cls, v):
        """Map ORM's full_name → API's name before Pydantic field validation."""
        if isinstance(v, dict):
            if "full_name" in v and "name" not in v:
                v = dict(v)
                v["name"] = v.pop("full_name")
            return v
        # ORM object — read attributes directly
        return {
            "id": v.id,
            "name": v.full_name,
            "email": v.email,
            "role": v.role,
            "language_pref": v.language_pref or "en",
            "xp_points": v.xp_points or 0,
            "streak_days": v.streak_days or 0,
            "created_at": v.created_at,
        }


class UserWrapper(BaseModel):
    """Response wrapper for GET /auth/me — frontend reads response.data.user"""
    user: UserResponse


class Token(BaseModel):
    """Returned after successful login/register."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
