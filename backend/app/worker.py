"""Reminder worker: a standalone process that polls for due reminders.

12-factor admin/long-running process. It shares the application's models and
config but runs outside the request/response cycle: on a fixed interval it
scans visits and rituals and generates any missing in-app notifications (see
``app.services.notifications``). Run it with ``python -m app.worker``; in
docker-compose it is the ``worker`` service.

The loop is deliberately resilient — a single bad tick (e.g. the database not
yet migrated at startup) is logged and retried rather than crashing the
process.
"""

import logging
import signal
import threading
from datetime import UTC, datetime
from types import FrameType

from app.core.config import settings
from app.core.logging import configure_logging
from app.db.session import SessionLocal
from app.services import notifications as notification_service

logger = logging.getLogger("app.worker")

# Set by the signal handler to break the loop on SIGTERM/SIGINT.
_stop = threading.Event()


def _handle_signal(signum: int, _frame: FrameType | None) -> None:
    logger.info("worker received signal %s, shutting down", signum)
    _stop.set()


def run_once(now: datetime | None = None) -> int:
    """One generation pass in its own session. Returns notifications created."""
    db = SessionLocal()
    try:
        created = notification_service.generate(db, now or datetime.now(UTC))
        if created:
            logger.info("generated %d reminder notification(s)", created)
        return created
    finally:
        db.close()


def main() -> None:
    configure_logging()
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    interval = settings.NOTIFICATIONS_POLL_SECONDS
    logger.info("reminder worker started, polling every %ss", interval)

    while not _stop.is_set():
        try:
            run_once()
        except Exception:  # noqa: BLE001 — keep polling through transient errors
            logger.exception("reminder generation tick failed; will retry")
        # Interruptible sleep so SIGTERM stops us promptly.
        _stop.wait(interval)

    logger.info("reminder worker stopped")


if __name__ == "__main__":
    main()
