from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Tuple ,List
from sqlalchemy import select , update
from datetime import datetime, timezone

from app.db.models.users import Users
from app.core.config import settings
from app.utils.pas_hashing import get_hash_pass, match_password
from app.core.exceptions import InvalidPasswordError , UserNotFindError
class UserRepository:

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, user_id) -> Optional[Users]:
        result = await self.db.execute(select(Users).where(Users.id == user_id))
        return result.scalar_one_or_none()
    
    async def get_by_name(self, username) -> Optional[Users]:
        result = await self.db.execute(select(Users).where(Users.username == username))
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
    
    async def update_login_time(self, user_id)->None:
        query = (
                update(Users)
                .where(Users.id == user_id)
                .values(last_login = datetime.now(timezone.utc)) 
            )
        try:
            await self.db.execute(query)
            await self.db.commit()
        except Exception as e:
            await self.db.rollback()
            raise e
    
    async def user_login(self, username:str , password:str)->Users:
        user = await self.get_by_name(username=username)
        if not user:
            raise UserNotFindError()
        if not match_password(user.hashed_password , password):
            raise InvalidPasswordError()
        await self.update_login_time(user.id)
        return user
    
    async def get_all_users(self)->List[Users]:
        result = await self.db.execute(select(Users))
        return result.scalars().all()
    
    async def get_all_workers(self)->List[Users]:
        result = await self.db.execute(select(Users).where(Users.role == "worker"))
        return result.scalars().all()

    async def get_all_admins(self)->List[Users]:
        result = await self.db.execute(select(Users).where(Users.role == "admin"))
        return result.scalars().all()

