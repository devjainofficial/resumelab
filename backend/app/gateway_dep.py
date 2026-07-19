"""App-wide gateway singleton (mock unless LLM_GATEWAY_MODE=real)."""

from __future__ import annotations

from llm.gateway import Gateway, get_gateway

_gateway: Gateway | None = None


def get_app_gateway() -> Gateway:
    global _gateway
    if _gateway is None:
        _gateway = get_gateway()
    return _gateway
