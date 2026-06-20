from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from sqlalchemy import select, delete, or_, and_
from sqlalchemy.orm import joinedload

from app.db.models.stock import Stock
from app.db.models.products import Products
from app.db.models.categories import Categories
from app.core.exceptions import CategoryNotFound

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
    

    async def get_products_by_category_name(self, cat_name):
        result = await self.db.execute(select(Products).
                                       join(Products.stock).
                                       options(joinedload(Products.stock)).
                                       join(Products.category).
                                       options(joinedload(Products.category)).
                                       where(Categories.name == cat_name))
        return result.scalars().all()
    
    async def get_products_by_category_id(self, cat_id):
        result = await self.db.execute(select(Products).
                                       join(Products.stock).
                                       options(joinedload(Products.stock)).
                                       join(Products.category).
                                       options(joinedload(Products.category)).
                                       where(Categories.id == cat_id))
        return result.scalars().all()
    

    async def delete_product_by_name(self, name) -> int:
        result = await self.db.execute(delete(Products).where(Products.name == name))
        try:
            await self.db.commit()
            return result.rowcount
        except Exception as e:
            await self.db.rollback()
            raise e
        
    async def delete_product_by_id(self, prod_id) -> int:
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
                                        sku: str, 
                                        qr_code_uuid: str, initial_quantity: int,
                                        category_id: Optional[int]=None, category_name: Optional[str]=None,
                                        description: Optional[str] = None) -> Products:
        if category_id == None and category_name == None:
            raise TypeError()
        new_stock = Stock(quantity=initial_quantity)
        
        if category_name:
            resp = await self.db.execute(select(Categories).where(Categories.name == category_name))
            cat = resp.scalar_one_or_none()
            if cat:
                category_id = cat.id
            else:
                raise CategoryNotFound()
            
        new_product = Products(
            name=name,
            category_id=category_id,
            sku=sku,
            qr_code_uuid=qr_code_uuid,
            description=description,
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
            
    async def get_product_detailed(self, product_id: Optional[int] = None, name: Optional[str] = None):
        query = select(
            Products.id,
            Products.name,
            Products.sku,
            Products.qr_code_uuid,
            Products.description,
            Products.category_id,
            Categories.name.label("category_name"),
            Stock.quantity,
            Stock.update_at.label("stock_updated_at")
        ).join(Stock, Products.id == Stock.product_id)\
         .outerjoin(Categories, Products.category_id == Categories.id)

        if product_id is not None:
            query = query.where(Products.id == product_id)
        elif name is not None:
            query = query.where(Products.name == name)
        else:
            return None

        result = await self.db.execute(query)
        return result.mappings().first()

    async def get_all_products_detailed(
        self, 
        limit: int, 
        offset: int,
        search: Optional[str] = None,
        category_id: Optional[int] = None,
        category_name: Optional[str] = None,
        sort_by: str = "name",
        sort_order: str = "asc"  
    ):
        query = select(
            Products.id,
            Products.name,
            Products.sku,
            Products.qr_code_uuid,
            Products.description,
            Products.category_id,
            Categories.name.label("category_name"),
            Stock.quantity,
            Stock.update_at.label("stock_updated_at")
        ).join(Stock, Products.id == Stock.product_id)\
         .outerjoin(Categories, Products.category_id == Categories.id)

        if search:
            query = query.where(or_(
                Products.name.ilike(f"%{search}%"),
                Products.sku.ilike(f"%{search}%")
            ))

        if category_id is not None:
            query = query.where(Products.category_id == category_id)
        elif category_name:
            query = query.where(Categories.name == category_name)

        order_column = Products.name
        if sort_by == "quantity":
            order_column = Stock.quantity
        elif sort_by == "stock_updated_at":
            order_column = Stock.update_at
        elif sort_by == "sku":
            order_column = Products.sku

        if sort_order.lower() == "desc":
            query = query.order_by(order_column.desc())
        else:
            query = query.order_by(order_column.asc())
        
        query = query.limit(limit).offset(offset)
        result = await self.db.execute(query)
        return result.mappings().all()