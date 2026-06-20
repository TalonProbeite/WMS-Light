from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from sqlalchemy import select, delete

from app.db.models.categories import Categories
from app.db.models.products import Products
from app.core.exceptions import CategoriesNotEmptyError

class CategoriesRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, cat_id: int) -> Optional[Categories]:
        result = await self.db.execute(select(Categories).where(Categories.id == cat_id))
        return result.scalar_one_or_none()
    
    async def add_categories(self, name: str, description: Optional[str] = None) -> Categories:
        cat = Categories(
            name=name, 
            description=description
        )
        try:
            self.db.add(cat)
            await self.db.commit()
            await self.db.refresh(cat)
            return cat
        except Exception as e:
            await self.db.rollback()
            raise e
        
    async def get_by_name(self, name: str) -> Optional[Categories]:
        result = await self.db.execute(select(Categories).where(Categories.name == name))
        return result.scalar_one_or_none()
    
    async def delete_cat_by_name(self, cat_name: str) -> int:
        category = await self.get_by_name(name=cat_name)
        if not category:
            return 0
            
        prod = await self.db.execute(select(Products).where(Products.category_id == category.id).limit(1))
        if prod.scalar_one_or_none():
            raise CategoriesNotEmptyError()
            
        try:
            res = await self.db.execute(delete(Categories).where(Categories.name == cat_name))
            await self.db.commit()
            return res.rowcount
        except Exception as e:
            await self.db.rollback()
            raise e
        
    async def get_all_cat(self) -> List[Categories]:
        res = await self.db.execute(select(Categories).order_by(Categories.name.asc()))
        return res.scalars().all()

    async def update_category(self, cat_id: int, name: str, description: Optional[str] = None) -> Optional[Categories]:
        cat = await self.get_by_id(cat_id)
        if not cat:
            return None
            
        cat.name = name
        cat.description = description
        
        try:
            await self.db.commit()
            await self.db.refresh(cat)
            return cat
        except Exception as e:
            await self.db.rollback()
            raise e