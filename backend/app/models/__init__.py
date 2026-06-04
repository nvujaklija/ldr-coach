"""ORM models. Importing this package registers every table on Base.metadata."""

from app.models.check_in import CheckIn
from app.models.couple import Couple, CoupleInvite, CoupleMember
from app.models.milestone import Milestone
from app.models.notification import Notification, NotificationPreference
from app.models.ritual import CoupleRitual, RitualInstance, RitualTemplate
from app.models.user import User
from app.models.visit import Visit

__all__ = [
    "CheckIn",
    "Couple",
    "CoupleInvite",
    "CoupleMember",
    "CoupleRitual",
    "Milestone",
    "Notification",
    "NotificationPreference",
    "RitualInstance",
    "RitualTemplate",
    "User",
    "Visit",
]
