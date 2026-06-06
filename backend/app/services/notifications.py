"""Outbound notifications.

Kept deliberately tiny: an in-app notification is just a log line today (the
client learns about a moment by polling ``/be-real/status``), and email is an
opt-in stub gated by ``settings.EMAIL_ENABLED``. Centralising it here means the
delivery mechanism can grow (a real queue, SES, …) without touching callers.
"""

import logging

from app.core.config import settings

logger = logging.getLogger("app.notifications")


def notify_moment_scheduled(recipient_emails: list[str], scheduled_utc_iso: str) -> None:
    """Tell both partners a BeReal moment is queued.

    ``recipient_emails`` is the couple's two addresses; ``scheduled_utc_iso`` is
    the moment's instant. In-app delivery is implicit (the moment row is the
    notification); email is sent only when explicitly enabled.
    """
    for email in recipient_emails:
        logger.info("bereal.notify in_app email=%s scheduled=%s", email, scheduled_utc_iso)
        if settings.EMAIL_ENABLED:
            # Placeholder for a real provider; logged so it's observable in dev.
            logger.info("bereal.notify email_send to=%s scheduled=%s", email, scheduled_utc_iso)
