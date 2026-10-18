import uuid

from app.common.schemas import CamelModel, UtcDateTime


class UserProfile(CamelModel):
    id: uuid.UUID
    email: str
    display_name: str | None
    created_at: UtcDateTime
