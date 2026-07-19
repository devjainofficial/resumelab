"""Supabase JWT validation for FastAPI routes.

Validates the caller's bearer token against Supabase's /auth/v1/user endpoint,
which works for both legacy and current signing schemes without holding any
signing secret here. Results are cached briefly to avoid a network hop per
request.
"""

from __future__ import annotations

import os
import time

import httpx
from fastapi import Depends, HTTPException, Request

_CACHE_TTL_SECONDS = 60
_cache: dict[str, tuple[float, dict]] = {}


def _supabase_url() -> str:
    url = os.environ.get("SUPABASE_URL", "")
    if not url:
        raise RuntimeError("SUPABASE_URL is not configured")
    return url.rstrip("/")


def _publishable_key() -> str:
    return os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")


async def get_current_user(request: Request) -> dict:
    """FastAPI dependency: returns the Supabase user for the bearer token or
    raises 401. Every protected route depends on this."""
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not signed in")
    token = auth[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not signed in")

    now = time.monotonic()
    cached = _cache.get(token)
    if cached and now - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{_supabase_url()}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": _publishable_key(),
            },
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Session expired or invalid")

    user = resp.json()
    _cache[token] = (now, user)
    return user


CurrentUser = Depends(get_current_user)
