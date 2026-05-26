"""JWT auth helpers for the Mino Bimaadiziwin backend."""
from __future__ import annotations
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from . import config, db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def create_access_token(username: str, role: str) -> str:
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": username,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=config.JWT_EXPIRE_HOURS)).timestamp()),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALG)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALG])
    except JWTError:
        return None


def get_current_user(
    request: Request, token: Optional[str] = Depends(oauth2_scheme)
) -> dict:
    candidate = token
    if not candidate:
        auth = request.headers.get("Authorization", "")
        if auth.lower().startswith("bearer "):
            candidate = auth.split(None, 1)[1].strip()
    if not candidate:
        candidate = request.cookies.get("atlas_token")
    if not candidate:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    data = decode_token(candidate)
    if not data:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    return {"username": data.get("sub"), "role": data.get("role")}


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin role required")
    return user


def optional_user(request: Request) -> Optional[dict]:
    auth = request.headers.get("Authorization", "")
    token = None
    if auth.lower().startswith("bearer "):
        token = auth.split(None, 1)[1].strip()
    if not token:
        token = request.cookies.get("atlas_token")
    if not token:
        return None
    data = decode_token(token)
    if not data:
        return None
    return {"username": data.get("sub"), "role": data.get("role")}
