"""The ONE LLM gateway. Every LLM call in the product goes through here.

Hard rules (from CLAUDE.md, do not weaken):
- cache first, keyed by (task, content hash): identical inputs never hit the
  API twice
- model tiering: flash-lite for extraction / gap detection / question
  generation; flash for rewrites and repairs; nothing larger without an env
  flag
- budgets: per-user daily token cap and a global daily cap from env; over
  budget returns a friendly message, never a silent charge
- every call is logged (user, task, model, tokens in/out)
- dev and CI run in mock mode; real calls require LLM_GATEWAY_MODE=real and
  a GEMINI_API_KEY
"""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass, field
from datetime import date

# Task -> model tier. Anything not listed here is not a valid LLM task.
MODEL_TIERS: dict[str, str] = {
    "extract": "gemini-flash-lite",
    "gap_detect": "gemini-flash-lite",
    "question_gen": "gemini-flash-lite",
    "rewrite": "gemini-flash",
    "repair": "gemini-flash",
    "jd_enhance": "gemini-flash",
}

BUDGET_MESSAGE = (
    "You've reached today's free usage limit. Come back tomorrow — "
    "your work is saved."
)


class BudgetExceeded(Exception):
    """Raised when a call would exceed a daily token cap. Carries the
    user-facing message; callers surface it, they never retry around it."""

    def __init__(self) -> None:
        super().__init__(BUDGET_MESSAGE)


class UnknownTask(Exception):
    pass


def content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


@dataclass
class UsageRecord:
    user_id: str
    task: str
    model: str
    tokens_in: int
    tokens_out: int
    day: date


@dataclass
class Gateway:
    """Cache -> budget -> model -> log. Stores are in-memory here; the
    Supabase-backed stores plug in behind the same interface in slice 1+."""

    per_user_daily_cap: int = field(
        default_factory=lambda: int(os.environ.get("DAILY_TOKEN_CAP_USER", "150000"))
    )
    global_daily_cap: int = field(
        default_factory=lambda: int(os.environ.get("DAILY_TOKEN_CAP_GLOBAL", "2000000"))
    )
    _cache: dict[tuple[str, str], str] = field(default_factory=dict)
    _usage: list[UsageRecord] = field(default_factory=list)

    def model_for(self, task: str) -> str:
        if task not in MODEL_TIERS:
            raise UnknownTask(task)
        return MODEL_TIERS[task]

    def _tokens_today(self, day: date, user_id: str | None = None) -> int:
        return sum(
            r.tokens_in + r.tokens_out
            for r in self._usage
            if r.day == day and (user_id is None or r.user_id == user_id)
        )

    def call(self, *, user_id: str, task: str, content: str, today: date) -> str:
        model = self.model_for(task)

        key = (task, content_hash(content))
        if key in self._cache:
            return self._cache[key]  # zero tokens, zero logging of a new call

        if self._tokens_today(today, user_id) >= self.per_user_daily_cap:
            raise BudgetExceeded()
        if self._tokens_today(today) >= self.global_daily_cap:
            raise BudgetExceeded()

        result, tokens_in, tokens_out = self._invoke_model(model, task, content)

        self._usage.append(
            UsageRecord(
                user_id=user_id,
                task=task,
                model=model,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                day=today,
            )
        )
        self._cache[key] = result
        return result

    def _invoke_model(self, model: str, task: str, content: str) -> tuple[str, int, int]:
        raise NotImplementedError("use MockGateway or a real implementation")

    @property
    def usage_log(self) -> list[UsageRecord]:
        return list(self._usage)


@dataclass
class MockGateway(Gateway):
    """Deterministic gateway for dev and CI. Never talks to any API."""

    calls: list[tuple[str, str]] = field(default_factory=list)  # (model, task)

    def _invoke_model(self, model: str, task: str, content: str) -> tuple[str, int, int]:
        self.calls.append((model, task))
        # Deterministic fake: output derived from input, token counts ~ length.
        result = f"[mock:{task}:{content_hash(content)[:12]}]"
        tokens = max(1, len(content) // 4)
        return result, tokens, tokens // 2


def get_gateway() -> Gateway:
    """Factory used by the app. Defaults to mock; real mode must be explicit
    AND have a key, so CI can never accidentally spend tokens."""
    mode = os.environ.get("LLM_GATEWAY_MODE", "mock")
    if mode == "real":
        if not os.environ.get("GEMINI_API_KEY"):
            raise RuntimeError("LLM_GATEWAY_MODE=real requires GEMINI_API_KEY")
        raise NotImplementedError("real Gemini gateway lands in slice 2+")
    return MockGateway()
