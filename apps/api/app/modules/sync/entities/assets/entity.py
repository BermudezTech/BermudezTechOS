from app.db.models.assets import Asset
from app.modules.sync.core.entity import SyncEntity
from app.modules.sync.entities.assets.schemas import AssetRecord


class AssetsSyncEntity(SyncEntity[AssetRecord]):
    table = "assets"
    model = Asset
    record_schema = AssetRecord
