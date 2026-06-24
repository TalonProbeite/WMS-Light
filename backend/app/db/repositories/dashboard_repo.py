from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict

from app.db.models.products import Products
from app.db.models.stock import Stock
from app.db.models.categories import Categories

class DashboardRepository:

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_general_stats(self) -> Dict[str, int]:
        
        total_products_query = select(func.count(Products.id))
        total_products_res = await self.db.execute(total_products_query)
        total_products = total_products_res.scalar_one()

        
        out_of_stock_query = select(func.count(Stock.id)).where(Stock.quantity == 0)
        out_of_stock_res = await self.db.execute(out_of_stock_query)
        out_of_stock = out_of_stock_res.scalar_one()

       
        total_categories_query = select(func.count(Categories.id))
        total_categories_res = await self.db.execute(total_categories_query)
        total_categories = total_categories_res.scalar_one()

        return {
            "total_products": total_products,
            "out_of_stock_products": out_of_stock,
            "total_categories": total_categories
        }