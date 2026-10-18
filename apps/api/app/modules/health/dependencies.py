from app.core.database import SessionDep
from app.modules.health.health_service import HealthService


def get_health_service(session: SessionDep) -> HealthService:
    return HealthService(session)
