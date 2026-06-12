from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Tuple
from sqlalchemy import select

from app.db.models.users import Users
from app.core.config import settings
from app.utils.pas_hashing import get_hash_pass, match_password

class UserRepository:

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, user_id) -> Optional[Users]:
        result = await self.db.execute(select(Users).where(Users.id == user_id))
        return result.scalar_one_or_none()
    

    async def add_superadmin(self) -> Tuple[Users, str]:
        result = await self.db.execute(select(Users).where(Users.role == "superadmin"))
        admin_obj = result.scalar_one_or_none()
        
        if not admin_obj:
            superadmin = Users(
                username = settings.db.FIRST_SUPERUSER_USERNAME,
                role = "superadmin",
                phone = settings.db.FIRST_SUPERUSER_PHONE,
                hashed_password = get_hash_pass(settings.db.FIRST_SUPERUSER_PASSWORD)    
            )

            try:
                self.db.add(superadmin)
                await self.db.commit()
                await self.db.refresh(superadmin)
                return (superadmin, "created")
            except Exception as e:
                await self.db.rollback()
                raise e
                
        return (admin_obj, "existing")