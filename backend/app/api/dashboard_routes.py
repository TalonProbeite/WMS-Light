from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db.database import get_db
from app.api.deps import RoleChecker
from app.schemas.dashboard import DashboardStatsResponse
from app.db.repositories.dashboard_repo import DashboardRepository

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get(
    "/stats", 
    response_model=DashboardStatsResponse, 
    dependencies=[Depends(RoleChecker(["admin", "superadmin"]))]
)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    repo = DashboardRepository(db)
    try:
        stats = await repo.get_general_stats()
        return stats
    except Exception as e:
        logger.exception(f"Unexpected error while fetching dashboard stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")