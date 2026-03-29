"""
test_alerts.py — Unit tests for the fire-and-forget alert service.

All HTTP calls are mocked — no n8n instance required to run these tests.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ── fire_alert with a valid URL → httpx POST is called ───────────────────────

@pytest.mark.asyncio
async def test_fire_alert_valid_url_calls_post():
    mock_response = MagicMock()
    mock_response.status_code = 200

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(return_value=mock_response)

    with patch("app.services.alerts.ALERT_TYPES", {"high_risk": "http://n8n:5678/webhook/test"}):
        with patch("app.services.alerts.httpx.AsyncClient", return_value=mock_client):
            from app.services.alerts import fire_alert
            await fire_alert("high_risk", {"student_id": "abc", "risk_level": "high"})

    mock_client.post.assert_called_once()
    call_kwargs = mock_client.post.call_args
    assert call_kwargs[0][0] == "http://n8n:5678/webhook/test"


# ── fire_alert with empty URL → no HTTP call made (alerts disabled) ───────────

@pytest.mark.asyncio
async def test_fire_alert_empty_url_skips_http():
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock()

    with patch("app.services.alerts.ALERT_TYPES", {"high_risk": ""}):
        with patch("app.services.alerts.httpx.AsyncClient", return_value=mock_client):
            from app.services.alerts import fire_alert
            await fire_alert("high_risk", {"student_id": "abc"})

    mock_client.post.assert_not_called()


# ── fire_alert with unknown type → no HTTP call ───────────────────────────────

@pytest.mark.asyncio
async def test_fire_alert_unknown_type_skips_http():
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock()

    with patch("app.services.alerts.ALERT_TYPES", {}):
        with patch("app.services.alerts.httpx.AsyncClient", return_value=mock_client):
            from app.services.alerts import fire_alert
            await fire_alert("nonexistent_type", {})

    mock_client.post.assert_not_called()


# ── fire_alert with failing URL → no exception raised (fire-and-forget) ───────

@pytest.mark.asyncio
async def test_fire_alert_network_failure_does_not_raise():
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(side_effect=Exception("connection refused"))

    with patch("app.services.alerts.ALERT_TYPES", {"high_risk": "http://broken:9999/webhook"}):
        with patch("app.services.alerts.httpx.AsyncClient", return_value=mock_client):
            from app.services.alerts import fire_alert
            # Must not raise
            await fire_alert("high_risk", {"student_id": "abc"})
