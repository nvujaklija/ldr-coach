"""ORM models. Importing this package registers every table on Base.metadata."""

from app.models.bucket_item import BucketItem
from app.models.check_in import CheckIn
from app.models.couple import Couple, CoupleInvite, CoupleMember
from app.models.letter import Letter
from app.models.memory_item import MemoryItem
from app.models.milestone import Milestone
from app.models.notification import Notification, NotificationPreference
from app.models.ritual import CoupleRitual, RitualInstance, RitualTemplate
from app.models.user import User
from app.models.visit import Visit

__all__ = [
    "BucketItem",
    "CheckIn",
    "Couple",
    "CoupleInvite",
    "CoupleMember",
    "CoupleRitual",
    "Letter",
    "MemoryItem",
    "Milestone",
    "Notification",
    "NotificationPreference",
    "RitualInstance",
    "RitualTemplate",
    "User",
    "Visit",
]
