"""Guard global de autenticación: toda ruta exige sesión salvo las marcadas con `@public`."""

from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.common.decorators import is_public
from app.core.clock import Clock, get_clock
from app.core.database import SessionDep
from app.core.errors import UnauthenticatedError
from app.core.security import decode_access_token
from app.db.models.users import User

_bearer = HTTPBearer(auto_error=False)


async def auth_guard(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    session: SessionDep,
    clock: Annotated[Clock, Depends(get_clock)],
) -> None:
    if is_public(request.scope.get("endpoint")):
        return
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise UnauthenticatedError()
    user_id = decode_access_token(credentials.credentials, clock.now())
    user = await session.get(User, user_id)
    if user is None:
        raise UnauthenticatedError()
    request.state.user = user


def current_user(request: Request) -> User:
    user = getattr(request.state, "user", None)
    if not isinstance(user, User):
        raise UnauthenticatedError()
    return user


CurrentUser = Annotated[User, Depends(current_user)]
