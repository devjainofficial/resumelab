"""The ONE LLM gateway. Every LLM call in the product goes through here.

Hard rules (from CLAUDE.md, do not weaken):
- cache first, keyed by (task, content hash): identical inputs never hit the
  API twice
- model tiering: lite for extraction / gap detection / question generation;
  full for rewrites and repairs; nothing larger without an env flag
- budgets: per-user daily token cap and a global daily cap from env; over
  budget returns a friendly message, never a silent charge
- every call is logged (user, task, model, tokens in/out)
- dev and CI run in mock mode; real calls require LLM_GATEWAY_MODE=real and
  provider credentials

Provider switch: the active provider is read from the llm_config table in
Supabase (single-row, admin edits in the table editor). The gateway reads it
once at startup and caches it; a restart or env override picks up changes.

Supported providers (via LiteLLM):
- gemini: GEMINI_API_KEY
- azure: AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT,
         AZURE_OPENAI_API_VERSION, AZURE_OPENAI_DEPLOYMENT_NAME
"""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass, field
from datetime import date

# Provider -> (lite model id, full model id) as LiteLLM expects them.
PROVIDER_MODELS: dict[str, dict[str, str]] = {
    "gemini": {
        "lite": "gemini/gemini-2.0-flash-lite",
        "full": "gemini/gemini-2.0-flash",
    },
    "azure": {
        "lite": "azure/{deployment}",
        "full": "azure/{deployment}",
    },
}

# Task -> tier. Anything not listed here is not a valid LLM task.
TASK_TIERS: dict[str, str] = {
    "extract": "lite",
    "gap_detect": "lite",
    "question_gen": "lite",
    "rewrite": "full",
    "repair": "full",
    "jd_enhance": "full",
    "screenshot_extract": "full",
}

BUDGET_MESSAGE = (
    "You've reached today's free usage limit. Come back tomorrow — "
    "your work is saved."
)


class BudgetExceeded(Exception):
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
    """Cache -> budget -> model -> log. Cache/budget stores are in-memory;
    usage_sink (when set) persists every model call to the llm_usage table —
    cache hits never reach the sink because they never reach the model."""

    provider: str = "gemini"
    per_user_daily_cap: int = field(
        default_factory=lambda: int(os.environ.get("DAILY_TOKEN_CAP_USER", "150000"))
    )
    global_daily_cap: int = field(
        default_factory=lambda: int(os.environ.get("DAILY_TOKEN_CAP_GLOBAL", "2000000"))
    )
    usage_sink: object | None = None
    _cache: dict[tuple[str, str], str] = field(default_factory=dict)
    _usage: list[UsageRecord] = field(default_factory=list)

    def _resolve_model(self, task: str) -> str:
        if task not in TASK_TIERS:
            raise UnknownTask(task)
        tier = TASK_TIERS[task]
        models = PROVIDER_MODELS.get(self.provider)
        if models is None:
            raise ValueError(f"unknown provider: {self.provider}")
        model_id = models[tier]
        if self.provider == "azure":
            deployment = os.environ.get(
                "AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o-mini"
            )
            model_id = model_id.replace("{deployment}", deployment)
        return model_id

    def model_for(self, task: str) -> str:
        return self._resolve_model(task)

    def _tokens_today(self, day: date, user_id: str | None = None) -> int:
        return sum(
            r.tokens_in + r.tokens_out
            for r in self._usage
            if r.day == day and (user_id is None or r.user_id == user_id)
        )

    def call(self, *, user_id: str, task: str, content: str, today: date) -> str:
        model = self._resolve_model(task)

        key = (task, content_hash(content))
        if key in self._cache:
            return self._cache[key]

        if self._tokens_today(today, user_id) >= self.per_user_daily_cap:
            raise BudgetExceeded()
        if self._tokens_today(today) >= self.global_daily_cap:
            raise BudgetExceeded()

        result, tokens_in, tokens_out = self._invoke_model(model, task, content)

        record = UsageRecord(
            user_id=user_id,
            task=task,
            model=model,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            day=today,
        )
        self._usage.append(record)
        if self.usage_sink is not None:
            try:
                self.usage_sink(record)  # type: ignore[operator]
            except Exception:
                pass
        self._cache[key] = result
        return result

    def _invoke_model(self, model: str, task: str, content: str) -> tuple[str, int, int]:
        raise NotImplementedError("use MockGateway or LiteLLMGateway")

    @property
    def usage_log(self) -> list[UsageRecord]:
        return list(self._usage)


@dataclass
class MockGateway(Gateway):
    """Deterministic gateway for dev and CI. Never talks to any API."""

    calls: list[tuple[str, str]] = field(default_factory=list)

    def _invoke_model(self, model: str, task: str, content: str) -> tuple[str, int, int]:
        self.calls.append((model, task))
        result = f"[mock:{task}:{content_hash(content)[:12]}]"
        tokens = max(1, len(content) // 4)
        return result, tokens, tokens // 2


@dataclass
class LiteLLMGateway(Gateway):
    """Real gateway that routes through LiteLLM to any supported provider."""

    def _invoke_model(self, model: str, task: str, content: str) -> tuple[str, int, int]:
        import litellm

        litellm.drop_params = True

        kwargs: dict = {
            "model": model,
            "messages": [{"role": "user", "content": content}],
            "temperature": 0.3,
        }

        if self.provider == "azure":
            kwargs["api_key"] = os.environ.get("AZURE_OPENAI_API_KEY", "")
            kwargs["api_base"] = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
            kwargs["api_version"] = os.environ.get(
                "AZURE_OPENAI_API_VERSION", "2024-10-21"
            )

        response = litellm.completion(**kwargs)

        result = response.choices[0].message.content or ""
        usage = response.usage
        tokens_in = usage.prompt_tokens if usage else len(content) // 4
        tokens_out = usage.completion_tokens if usage else len(result) // 4
        return result, tokens_in, tokens_out


def _read_active_provider() -> str:
    """Read the active provider from llm_config via Supabase REST.
    Falls back to env var LLM_PROVIDER, then 'gemini'."""
    import httpx

    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    secret = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if base and secret:
        try:
            resp = httpx.get(
                f"{base}/rest/v1/llm_config?id=eq.1&select=active_provider",
                headers={"apikey": secret, "Authorization": f"Bearer {secret}"},
                timeout=5,
            )
            rows = resp.json()
            if rows and isinstance(rows, list) and rows[0].get("active_provider"):
                return rows[0]["active_provider"]
        except Exception:
            pass
    return os.environ.get("LLM_PROVIDER", "gemini")


def get_gateway() -> Gateway:
    """Factory used by the app. Defaults to mock; real mode must be explicit
    AND have provider credentials, so CI can never accidentally spend tokens."""
    mode = os.environ.get("LLM_GATEWAY_MODE", "mock")
    if mode == "real":
        provider = _read_active_provider()
        if provider == "gemini" and not os.environ.get("GEMINI_API_KEY"):
            raise RuntimeError("provider=gemini requires GEMINI_API_KEY")
        if provider == "azure":
            missing = [
                k for k in ("AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT")
                if not os.environ.get(k)
            ]
            if missing:
                raise RuntimeError(f"provider=azure requires: {', '.join(missing)}")
        return LiteLLMGateway(provider=provider)
    return MockGateway()
