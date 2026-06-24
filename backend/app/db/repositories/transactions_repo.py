from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from sqlalchemy import select, update
from sqlalchemy.orm import joinedload
from datetime import datetime, timezone

from app.db.models.stock import Stock
from app.db.models.products import Products
from app.db.models.transactions import Transactions
from app.db.models.users import Users
from app.core.exceptions import ProductNotFoundError, InvalidTransactionError, InvalidTransactionTypeError, UserNotFindError

class TransactionsRepository:

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, tran_id: int) -> Optional[Transactions]:
        result = await self.db.execute(select(Transactions).where(Transactions.id == tran_id))
        return result.scalar_one_or_none()
    
    async def get_by_user_id(self, user_id: int) -> List[Transactions]:
        result = await self.db.execute(select(Transactions).where(Transactions.user_id == user_id))
        return result.scalars().all()

    async def get_by_product_id(self, product_id: int) -> List[Transactions]:
        result = await self.db.execute(select(Transactions).where(Transactions.product_id == product_id))
        return result.scalars().all()
    
    async def add_transaction(self, quantity: int, transaction_type: str, product_id: int, user_id: int) -> Transactions:
        if transaction_type not in ["incoming", "outgoing"]:
            raise InvalidTransactionTypeError()
        
        prod_res = await self.db.execute(select(Products).where(Products.id == product_id))
        product = prod_res.scalar_one_or_none()
        if not product:
            raise ProductNotFoundError()

        stock_res = await self.db.execute(select(Stock).where(Stock.product_id == product_id))
        stock = stock_res.scalar_one_or_none()
        if not stock:
            raise ProductNotFoundError()

        if transaction_type == "outgoing" and stock.quantity < quantity:
            raise InvalidTransactionError()

        if transaction_type == "incoming":
            stock.quantity += quantity
        elif transaction_type == "outgoing":
            stock.quantity -= quantity
        
        stock.update_at = datetime.now(timezone.utc)

        transaction = Transactions(
            quantity=quantity,
            transaction_type=transaction_type,
            product_id=product_id,
            user_id=user_id,
            created_at=datetime.now(timezone.utc)
        )
        
        try:
            self.db.add(transaction)
            await self.db.commit()
            await self.db.refresh(transaction)
            
            user_res = await self.db.execute(select(Users).where(Users.id == user_id))
            user = user_res.scalar_one_or_none()
            
            transaction.username = user.username if user else ""
            transaction.product_name = product.name
            
            return transaction
        except Exception as e:
            await self.db.rollback()
            raise e
    
    async def get_user_transactions(
        self, 
        limit: int, 
        offset: int,
        user_id: Optional[int] = None,
        user_name: Optional[str] = None,  
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        sort_order: str = "desc",
        transaction_type: Optional[str] = None
    ):
        if user_name:
            res = await self.db.execute(select(Users).where(Users.username == user_name))
            user = res.scalar_one_or_none()
            if not user:
                raise UserNotFindError()
            user_id = user.id  

        query = select(
            Transactions.id,
            Transactions.quantity,
            Transactions.transaction_type,
            Transactions.user_id,
            Transactions.product_id,
            Transactions.created_at,
            Users.username.label("username"),
            Products.name.label("product_name")
        ).join(Users, Transactions.user_id == Users.id).join(Products, Transactions.product_id == Products.id)
        
        if user_id is not None:
            query = query.where(Transactions.user_id == user_id)
            
        if transaction_type:
            query = query.where(Transactions.transaction_type == transaction_type)

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
        return result.all()


    async def get_all_transactions(
        self, 
        limit: int, 
        offset: int,
        transaction_type: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        sort_order: str = "desc"
    ):
        query = select(
            Transactions.id,
            Transactions.quantity,
            Transactions.transaction_type,
            Transactions.user_id,
            Transactions.product_id,
            Transactions.created_at,
            Users.username.label("username"),
            Products.name.label("product_name")
        ).join(Users, Transactions.user_id == Users.id).join(Products, Transactions.product_id == Products.id)
        
        if transaction_type:
            query = query.where(Transactions.transaction_type == transaction_type)

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
        return result.all()