from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional , List
from sqlalchemy import select, delete
from sqlalchemy.orm import joinedload

from app.db.models.stock import Stock
from app.db.models.products import Products
from app.db.models.categories import Categories


class ProductsRepository:

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, product_id) -> Optional[Products]:
        result = await self.db.execute(select(Products).
                                       join(Products.stock).
                                       options(joinedload(Products.stock)).
                                       join(Products.category).
                                       options(joinedload(Products.category)).
                                       where(Products.id == product_id))
        return result.scalar_one_or_none()
    
    async def get_by_name(self, product_name) -> Optional[Products]:
        result = await self.db.execute(select(Products).
                                       join(Products.stock).
                                       options(joinedload(Products.stock)).
                                       join(Products.category).
                                       options(joinedload(Products.category)).
                                       where(Products.name == product_name))
        return result.scalar_one_or_none()
    

    async def get_products_by_category_name(self , cat_name):
        result = await self.db.execute(select(Products).
                                       join(Products.stock).
                                       options(joinedload(Products.stock)).
                                       join(Products.category).
                                       options(joinedload(Products.category)).
                                       where(Categories.name == cat_name ))
        return result.scalars().all()
    
    async def get_products_by_category_id(self , cat_id):
        result = await self.db.execute(select(Products).
                                       join(Products.stock).
                                       options(joinedload(Products.stock)).
                                       join(Products.category).
                                       options(joinedload(Products.category)).
                                       where(Categories.id == cat_id ))
        return result.scalars().all()
    

    async def delete_product_by_name(self, name)->int:
        result = await self.db.execute(delete(Products).where(Products.name == name))
        try:
            await self.db.commit()
            return result.rowcount
        except Exception as e:
            await self.db.rollback()
            raise e
        
    async def delete_product_by_id(self, prod_id)->int:
        result = await self.db.execute(delete(Products).where(Products.id == prod_id))
        try:
            await self.db.commit()
            return result.rowcount
        except Exception as e:
            await self.db.rollback()
            raise e
    
    async def delete_products_by_cat(self, cat_id):
        query = delete(Products).where(Products.category_id == cat_id)
        
        res = await self.db.execute(query)
        try:
            await self.db.commit()
            return res.rowcount
        except Exception as e:
            await self.db.rollback()
            raise e
        
    async def create_product_with_stock(self, name: str, 
                                        category_id: int, sku:str, 
                                        qr_code_uuid:str,initial_quantity: int,
                                        description:Optional[str]= None) -> Products:
        new_stock = Stock(quantity=initial_quantity)
        
     
        new_product = Products(
            name=name,
            category_id=category_id,
            sku = sku,
            qr_code_uuid = qr_code_uuid,
            description = description,
            stock=new_stock 
        )
        
        self.db.add(new_product)
        
        try:
            await self.db.commit()
            
            await self.db.refresh(new_product)
            return new_product
            
        except Exception as e:
            await self.db.rollback()
            raise e
            