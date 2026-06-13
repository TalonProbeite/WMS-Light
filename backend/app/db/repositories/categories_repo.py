from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from sqlalchemy import select , delete

from app.db.models.categories import Categories



class CategoriesRepository:

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, cat_id) -> Optional[Categories]:
        result = await self.db.execute(select(Categories).where(Categories.id == cat_id))
        return result.scalar_one_or_none()
    
    async def add_categories(self , name:str , description:Optional[str]=None)->Categories:
        cat = Categories(
            name = name , 
            description = description or None
        )
        try:
            self.db.add(cat)
            await self.db.commit()
            await self.db.refresh(cat)
            return cat
        except Exception as e:
            await self.db.rollback()
            raise e
        
    async def get_by_name(self, name)->Optional[Categories]:
        result = await self.db.execute(select(Categories).where(Categories.name == name))
        return result.scalar_one_or_none()
    
    async def delete_cat_by_id(self ,cat_id)->int:
        res = await self.db.execute(delete(Categories).where(Categories.id == cat_id))
        try:
            await self.db.commit()
            return res.rowcount
        except Exception as e:
            await self.db.rollback()
            raise e
        
    
    async def delete_cat_by_name(self ,cat_name)->int:
        res = await self.db.execute(delete(Categories).where(Categories.name == cat_name))
        try:
            await self.db.commit()
            return res.rowcount
        except Exception as e:
            await self.db.rollback()
            raise e
        