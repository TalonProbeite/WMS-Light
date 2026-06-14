from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional , List
from sqlalchemy import select, update
from sqlalchemy.orm import joinedload
from datetime import datetime, timezone

from app.db.models.stock import Stock
from app.db.models.products import Products
from app.db.models.transactions import Transactions
from app.core.exceptions import ProductNotFoundError , InvalidTransactionError , InvalidTransactionTypeError

class TransactionsRepository:

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, tran_id:int) -> Optional[Transactions]:
        result = await self.db.execute(select(Transactions).
                                       where(Transactions.id == tran_id))
        return result.scalar_one_or_none()
    
    async def get_by_user_id(self,  user_id:int)-> List[Transactions]:
        result = await self.db.execute(select(Transactions).
                                       where(Transactions.user_id == user_id))
        return result.scalars().all()


    async def get_by_product_id(self,  product_id)-> List[Transactions]:
        result = await self.db.execute(select(Transactions).
                                       where(Transactions.product_id == product_id))
        return result.scalars().all()
    
    async def add_transaction(self, quantity:int , 
                              transaction_type:str , product_id:int , user_id:int)->Transactions:
        product = await self.db.execute(select(Products).
                                       join(Products.stock).
                                       options(joinedload(Products.stock)).
                                       where(Products.id == product_id))
        product_obj = product.scalar_one_or_none()
        if not product_obj:
            raise ProductNotFoundError()
        if product_obj.stock.quantity <  quantity and transaction_type == "outgoing":
            raise InvalidTransactionError()
        
        if transaction_type == "outgoing":
            query = (
                update(Stock)
                .where(Stock.product_id == product_id)
                .values(quantity=Stock.quantity - quantity, update_at = datetime.now(timezone.utc)) 
            )
        elif transaction_type == "incoming":
            query = (
                update(Stock)
                .where(Stock.product_id == product_id)
                .values(quantity=Stock.quantity + quantity, update_at = datetime.now(timezone.utc)) 
            )
        else:
            raise InvalidTransactionTypeError()
        
        
        transactions = Transactions(
                quantity = quantity,
                transaction_type = transaction_type,
                created_at = datetime.now(timezone.utc),
                product_id = product_id,
                user_id = user_id
        )
        try:
            self.db.add(transactions)
            await self.db.execute(query)
            await self.db.commit()
            await self.db.refresh(transactions)
            return transactions
        except Exception as e:
            await self.db.rollback()
            raise e

