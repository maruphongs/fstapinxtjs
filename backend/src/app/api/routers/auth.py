"""
Authentication endpoints router (login, register, token refresh).
"""
from fastapi import APIRouter

router = APIRouter(
    prefix="/auth",
    tags=["Auth"],
)
