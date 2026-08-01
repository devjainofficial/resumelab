"""Demo login endpoint for review and testing.

Accepts a DEMO_KEY secret, generates a Supabase magic-link token for
the DEMO_EMAIL address (admin API, no email sent), and returns the
token so the frontend can establish a real Supabase session.

Set two env vars to enable:
  DEMO_KEY   — any secret string; share this with reviewers
  DEMO_EMAIL — a Supabase Auth user that already exists

If either var is unset the endpoint returns 404 (feature is off).
"""

from __future__ import annotations

import os
from urllib.parse import parse_qs, urlparse

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])


class DemoRequest(BaseModel):
    key: str


@router.post("/demo-token")
async def demo_token(req: DemoRequest) -> dict:
    demo_key = os.environ.get("DEMO_KEY", "")
    demo_email = os.environ.get("DEMO_EMAIL", "")

    # Feature off when not configured
    if not demo_key or not demo_email:
        raise HTTPException(404, "Demo login is not enabled on this deployment")

    if req.key != demo_key:
        raise HTTPException(401, "Invalid demo key")

    supabase_url = os.environ["SUPABASE_URL"].rstrip("/")
    service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            f"{supabase_url}/auth/v1/admin/generate_link",
            json={"type": "magiclink", "email": demo_email},
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
            },
        )
        if r.status_code not in (200, 201):
            raise HTTPException(502, "Supabase admin API error — check DEMO_EMAIL exists in Auth users")

    data = r.json()
    # Supabase wraps the link in data.properties or at the top level depending on version
    action_link = (
        data.get("action_link")
        or data.get("data", {}).get("action_link")
        or data.get("data", {}).get("properties", {}).get("action_link")
        or ""
    )
    if not action_link:
        raise HTTPException(502, "No action_link in Supabase response")

    parsed = urlparse(action_link)
    qs = parse_qs(parsed.query)
    token = (qs.get("token") or qs.get("token_hash") or [None])[0]
    if not token:
        raise HTTPException(502, "Could not extract token from magic link")

    return {"token": token, "email": demo_email}
