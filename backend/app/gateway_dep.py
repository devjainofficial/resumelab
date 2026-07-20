"""App-wide gateway singleton (mock unless LLM_GATEWAY_MODE=real), with a
sink that persists every model call to llm_usage per the cost rules."""

from __future__ import annotations

import os

import httpx

from llm.gateway import Gateway, UsageRecord, get_gateway

_gateway: Gateway | None = None


def _persist_usage(record: UsageRecord) -> None:
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    secret = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not secret:
        return
    httpx.post(
        f"{base}/rest/v1/llm_usage",
        json={
            "user_id": record.user_id,
            "task": record.task,
            "model": record.model,
            "tokens_in": record.tokens_in,
            "tokens_out": record.tokens_out,
        },
        headers={"apikey": secret, "Authorization": f"Bearer {secret}"},
        timeout=10,
    )


def get_app_gateway() -> Gateway:
    global _gateway
    if _gateway is None:
        _gateway = get_gateway()
        _gateway.usage_sink = _persist_usage
    return _gateway
