from app.db.models.users import User
from app.modules.users.schemas import UserProfile


class UsersService:
    def get_profile(self, user: User) -> UserProfile:
        return UserProfile.model_validate(user)
