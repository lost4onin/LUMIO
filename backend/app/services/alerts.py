"""
alerts.py — Fire-and-forget webhook alerts to n8n.

n8n handles the Gmail OAuth and email delivery; FastAPI only triggers it.
Alerts never raise — a broken webhook must not affect the main request flow.
"""
import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

ALERT_TYPES = {
    "high_risk":         settings.N8N_WEBHOOK_HIGH_RISK,
    "struggle_detected": settings.N8N_WEBHOOK_STRUGGLE,
    "weekly_summary":    settings.N8N_WEBHOOK_WEEKLY,
}


async def fire_alert(alert_type: str, payload: dict) -> None:
    """
    POST payload to the n8n webhook URL for the given alert type.

    If the URL is empty (default), the alert is silently skipped — this lets
    the app run in dev without n8n webhooks configured.
    """
    url = ALERT_TYPES.get(alert_type, "")
    if not url:
        logger.debug("[alert] %s skipped — no webhook URL configured", alert_type)
        return

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=5.0)
            logger.info("[alert] %s → %s", alert_type, response.status_code)
    except Exception as exc:
        logger.warning("[alert] %s failed: %s", alert_type, exc)
