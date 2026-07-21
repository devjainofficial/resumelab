"""Tests for the cost rules in llm/gateway.py. These encode the hard rules
from CLAUDE.md — if a change breaks one of these, the change is wrong."""

from datetime import date

import pytest

from llm.gateway import (
    BUDGET_MESSAGE,
    BudgetExceeded,
    MockGateway,
    UnknownTask,
    get_gateway,
)

TODAY = date(2026, 7, 19)


def make_gateway(**kwargs) -> MockGateway:
    return MockGateway(**kwargs)


def test_identical_inputs_hit_cache_not_model():
    gw = make_gateway()
    r1 = gw.call(user_id="u1", task="extract", content="same resume text", today=TODAY)
    r2 = gw.call(user_id="u1", task="extract", content="same resume text", today=TODAY)
    assert r1 == r2
    assert len(gw.calls) == 1  # second call never reached the model
    assert len(gw.usage_log) == 1  # and logged no new usage


def test_cache_is_keyed_by_task_and_content():
    gw = make_gateway()
    gw.call(user_id="u1", task="extract", content="text A", today=TODAY)
    gw.call(user_id="u1", task="rewrite", content="text A", today=TODAY)
    gw.call(user_id="u1", task="extract", content="text B", today=TODAY)
    assert len(gw.calls) == 3  # different task or content -> distinct entries


def test_model_tiering():
    gw = make_gateway()
    for task in ("extract", "gap_detect", "question_gen"):
        assert gw.model_for(task) == "gemini/gemini-2.0-flash-lite"
    for task in ("rewrite", "repair", "jd_enhance", "screenshot_extract"):
        assert gw.model_for(task) == "gemini/gemini-2.0-flash"


def test_unknown_task_rejected():
    gw = make_gateway()
    with pytest.raises(UnknownTask):
        gw.call(user_id="u1", task="world_domination", content="x", today=TODAY)


def test_per_user_budget_enforced_with_friendly_message():
    gw = make_gateway(per_user_daily_cap=10)
    gw.call(user_id="u1", task="extract", content="long enough content to cost tokens", today=TODAY)
    with pytest.raises(BudgetExceeded) as exc:
        gw.call(user_id="u1", task="extract", content="different content, over budget", today=TODAY)
    assert BUDGET_MESSAGE in str(exc.value)
    assert len(gw.calls) == 1  # the over-budget call never reached the model


def test_budget_does_not_block_other_users():
    gw = make_gateway(per_user_daily_cap=10)
    gw.call(user_id="u1", task="extract", content="long enough content to cost tokens", today=TODAY)
    # u2 has spent nothing today and is unaffected by u1's cap
    gw.call(user_id="u2", task="extract", content="other user's content here", today=TODAY)
    assert len(gw.calls) == 2


def test_global_budget_enforced():
    gw = make_gateway(per_user_daily_cap=10_000, global_daily_cap=10)
    gw.call(user_id="u1", task="extract", content="long enough content to cost tokens", today=TODAY)
    with pytest.raises(BudgetExceeded):
        gw.call(user_id="u2", task="extract", content="a different user's content", today=TODAY)


def test_cached_result_served_even_when_over_budget():
    # A cache hit costs zero tokens, so it must succeed regardless of budget.
    gw = make_gateway(per_user_daily_cap=10)
    r1 = gw.call(user_id="u1", task="extract", content="long enough content to cost tokens", today=TODAY)
    r2 = gw.call(user_id="u1", task="extract", content="long enough content to cost tokens", today=TODAY)
    assert r1 == r2


def test_every_model_call_is_logged():
    gw = make_gateway()
    gw.call(user_id="u1", task="rewrite", content="some bullet points", today=TODAY)
    (rec,) = gw.usage_log
    assert rec.user_id == "u1"
    assert rec.task == "rewrite"
    assert rec.model == "gemini/gemini-2.0-flash"
    assert rec.tokens_in > 0


def test_default_factory_is_mock(monkeypatch):
    monkeypatch.delenv("LLM_GATEWAY_MODE", raising=False)
    assert isinstance(get_gateway(), MockGateway)


def test_real_mode_requires_api_key(monkeypatch):
    monkeypatch.setenv("LLM_GATEWAY_MODE", "real")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
        get_gateway()


def test_real_mode_azure_requires_keys(monkeypatch):
    monkeypatch.setenv("LLM_GATEWAY_MODE", "real")
    monkeypatch.setenv("LLM_PROVIDER", "azure")
    monkeypatch.delenv("AZURE_API_KEY", raising=False)
    monkeypatch.delenv("AZURE_API_BASE", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    with pytest.raises(RuntimeError, match="AZURE_API_KEY"):
        get_gateway()
