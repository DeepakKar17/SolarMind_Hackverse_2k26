"""PVAsset Repository implementation."""

from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.pv_asset import PVAsset
from app.repositories.base import BaseRepository
from app.schemas.pv_asset import PVAssetCreate, PVAssetUpdate


class PVAssetRepository(BaseRepository[PVAsset, PVAssetCreate, PVAssetUpdate]):
    """Repository handling database operations for PVAsset (String/MPPT) entities."""

    def __init__(self):
        super().__init__(PVAsset)

    def list_by_inverter(
        self,
        db: Session,
        inverter_id: str,
        *,
        asset_type: Optional[str] = None,
    ) -> List[PVAsset]:
        """Fetch all PVAssets associated with an inverter."""
        stmt = select(PVAsset).where(PVAsset.inverter_id == inverter_id)
        if asset_type:
            stmt = stmt.where(PVAsset.asset_type == asset_type)
        stmt = stmt.order_by(PVAsset.identifier.asc())
        return list(db.scalars(stmt).all())

    def get_by_inverter_and_identifier(
        self,
        db: Session,
        inverter_id: str,
        identifier: str,
    ) -> Optional[PVAsset]:
        """Lookup specific string / MPPT by inverter and identifier string."""
        stmt = select(PVAsset).where(
            PVAsset.inverter_id == inverter_id,
            PVAsset.identifier == identifier,
        )
        return db.scalar(stmt)


pv_asset_repository = PVAssetRepository()
