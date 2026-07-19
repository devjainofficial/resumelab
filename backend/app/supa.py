"""Thin server-side Supabase client (service role): PostgREST + Storage.

The service key bypasses RLS, so every call here MUST scope by the
authenticated user's id taken from a validated JWT — never from client input.
"""

from __future__ import annotations

import os

import httpx


class Supa:
    def __init__(self, base_url: str | None = None, secret: str | None = None):
        self.base = (base_url or os.environ["SUPABASE_URL"]).rstrip("/")
        self.secret = secret or os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    def _headers(self, extra: dict | None = None) -> dict:
        h = {"apikey": self.secret, "Authorization": f"Bearer {self.secret}"}
        if extra:
            h.update(extra)
        return h

    async def select(self, table: str, params: dict) -> list[dict]:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(
                f"{self.base}/rest/v1/{table}", params=params, headers=self._headers()
            )
            r.raise_for_status()
            return r.json()

    async def insert(self, table: str, row: dict) -> dict:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post(
                f"{self.base}/rest/v1/{table}",
                json=row,
                headers=self._headers({"Prefer": "return=representation"}),
            )
            r.raise_for_status()
            return r.json()[0]

    async def rpc(self, fn: str, args: dict):
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post(
                f"{self.base}/rest/v1/rpc/{fn}", json=args, headers=self._headers()
            )
            r.raise_for_status()
            return r.json()

    async def update(self, table: str, params: dict, patch: dict) -> None:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.patch(
                f"{self.base}/rest/v1/{table}",
                params=params,
                json=patch,
                headers=self._headers(),
            )
            r.raise_for_status()

    async def upload_file(self, bucket: str, path: str, data: bytes, content_type: str) -> None:
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.post(
                f"{self.base}/storage/v1/object/{bucket}/{path}",
                content=data,
                headers=self._headers(
                    {"Content-Type": content_type, "x-upsert": "true"}
                ),
            )
            r.raise_for_status()


_instance: Supa | None = None


def get_supa() -> Supa:
    global _instance
    if _instance is None:
        _instance = Supa()
    return _instance
