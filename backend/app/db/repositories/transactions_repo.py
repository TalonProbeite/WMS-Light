from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional , List
from sqlalchemy import select, update
from sqlalchemy.orm import joinedload
from datetime import datetime, timezone

from app.db.models.stock import Stock
from app.db.models.products import Products
from app.db.models.transactions import Transactions
from app.db.models.users import Users
from app.core.exceptions import ProductNotFoundError , InvalidTransactionError , InvalidTransactionTypeError , UserNotFindError

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


        
    async def get_all_transactions(
        self, 
        limit: int, 
        offset: int,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        sort_order: str = "desc"  
    ):
        
        query = select(Transactions)

        if date_from and date_to:
           
            query = query.where(Transactions.created_at.between(date_from, date_to))
        elif date_from:
            
            query = query.where(Transactions.created_at >= date_from)
        elif date_to:
           
            query = query.where(Transactions.created_at <= date_to)

        if sort_order.lower() == "asc":
            query = query.order_by(Transactions.created_at.asc())
        else:
            query = query.order_by(Transactions.created_at.desc())
        
        query = query.limit(limit).offset(offset)
        result = await self.db.execute(query)
        return result.scalars().all()
    
    
    async def get_user_transactions(
        self, 
        limit: int, 
        offset: int,
        user_id: Optional[int] = None,
        user_name: Optional[str] = None,  
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        sort_order: str = "desc"  
    ):
       
        if user_name:
            res = await self.db.execute(select(Users).where(Users.username == user_name))
            user = res.scalar_one_or_none()
            if not user:
                raise UserNotFindError()
            user_id = user.id  

        
        query = select(Transactions).where(Transactions.user_id == user_id)

        
        if date_from and date_to:
            query = query.where(Transactions.created_at.between(date_from, date_to))
        elif date_from:
            query = query.where(Transactions.created_at >= date_from)
        elif date_to:
            query = query.where(Transactions.created_at <= date_to)

      
        if sort_order.lower() == "asc":
            query = query.order_by(Transactions.created_at.asc())
        else:
            query = query.order_by(Transactions.created_at.desc())
        
        query = query.limit(limit).offset(offset)
        result = await self.db.execute(query)
        return result.scalars().all()