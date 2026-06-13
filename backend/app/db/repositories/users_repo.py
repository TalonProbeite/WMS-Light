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
    
    async def _add_user(self, username: str, password: str, 
                         role: str = "worker", phone: Optional[str] = None)->Users:
        user = Users(
            username = username,
            hashed_password = get_hash_pass(password),
            role = role,
            phone  = phone or None
        )
        try:
            self.db.add(user)
            await self.db.commit()
            await self.db.refresh(user)
            return user
        except Exception as e:
            await self.db.rollback()
            raise e


    async def add_superadmin(self) -> Tuple[Users, str]:
        result = await self.db.execute(select(Users).where(Users.role == "superadmin"))
        admin_obj = result.scalar_one_or_none()
        
        if not admin_obj:
            superadmin = await self._add_user(username=settings.db.FIRST_SUPERUSER_USERNAME,
                                         role="superadmin",
                                         phone=settings.db.FIRST_SUPERUSER_PHONE,
                                         password=settings.db.FIRST_SUPERUSER_PASSWORD)
            return (superadmin, "created")
        return (admin_obj, "existing")
    

    async def add_worker(self, username:str , password:str, phone:str = "")->Users:      
        worker = await self._add_user(username=username,
                                       role="worker",
                                       password=password,
                                       phone=phone)
        return worker
    
    async def add_admin(self, username:str , password:str, phone:str = "")->Users:      
        admin = await self._add_user(username=username,
                                       role="admin",
                                       password=password,
                                       phone=phone)
        return admin