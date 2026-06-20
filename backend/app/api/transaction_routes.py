from fastapi import APIRouter, Depends, HTTPException , Response , Request
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger
from datetime import datetime, timezone, timedelta
from typing import List , Optional

from app.schemas.transactions import CreateTransaction , TransactionResponse
from app.db.database import get_db
from app.db.repositories.transactions_repo import  TransactionsRepository
from app.utils.jwt import encode_jwt
from app.core.exceptions import InvalidTransactionError , InvalidTransactionTypeError , UserNotFindError
from app.api.deps import RoleChecker


router = APIRouter(prefix="/transactions", tags=["Transactions"])




@router.post("/create", response_model=TransactionResponse) 
async def create_transaction(
    transaction: CreateTransaction, 
    db: AsyncSession = Depends(get_db),
    
    user_info: dict = Depends(RoleChecker(["worker","admin", "superadmin"])) 
):
   
    current_user_id = user_info["id"]
    
    repo = TransactionsRepository(db)
    try:
        trans = await repo.add_transaction(quantity=transaction.quantity,
                                   transaction_type=transaction.transaction_type,
                                   product_id=transaction.product_id,
                                   user_id=current_user_id)
        return trans
    except InvalidTransactionTypeError as e:
        raise HTTPException(status_code=400 , detail="Invalid transaction type, valid types are: incoming or outgoing")
    except InvalidTransactionError as e:
        raise HTTPException(status_code=409 , detail="The transaction cannot be completed due to the current state of the resource.")
    except Exception as e:
        logger.exception(f"Unexpected error: {e.__cause__}")
        raise HTTPException(status_code=500, detail="Internal server error")
    
@router.get("/get_all" , response_model=List[TransactionResponse])
async def get_transactions(
    limit: int = 20,    
    offset: int = 0,   
    date_from: Optional[datetime] = None,  
    date_to: Optional[datetime] = None,    
    sort_order: str = "desc",          
    db: AsyncSession = Depends(get_db),
    user_info: dict = Depends(RoleChecker(["admin", "superadmin"])) 
):
    if limit > 100:
        limit = 100 
        
    if sort_order not in ["asc", "desc"]:
        sort_order = "desc"

    try:
        repo = TransactionsRepository(db)
        
        return await repo.get_all_transactions(
            limit=limit, 
            offset=offset, 
            date_from=date_from, 
            date_to=date_to, 
            sort_order=sort_order
        )
    except Exception as e:
        logger.exception(f"Unexpected error: {e.__cause__}")
        raise HTTPException(status_code=500, detail="Internal server error")
    


@router.get("/", response_model=List[TransactionResponse])
async def get_my_transactions(limit: int = 20,    
    offset: int = 0,   
    date_from: Optional[datetime] = None,  
    date_to: Optional[datetime] = None,    
    sort_order: str = "desc",          
    db: AsyncSession = Depends(get_db),
    user_info: dict = Depends(RoleChecker(["worker","admin", "superadmin"]))):

    if limit > 100:
        limit = 100 
        
    if sort_order not in ["asc", "desc"]:
        sort_order = "desc"

    try:
        repo = TransactionsRepository(db)
        
        return await repo.get_user_transactions(
            limit=limit, 
            offset=offset, 
            date_from=date_from, 
            date_to=date_to, 
            sort_order=sort_order,
            user_id = user_info["id"]
        )
    except Exception as e:
        logger.exception(f"Unexpected error: {e.__cause__}")
        raise HTTPException(status_code=500, detail="Internal server error")
    
 



@router.get("/user", response_model=List[TransactionResponse])
async def get_user_transactions_by_name(
    user_name: str,  
    limit: int = 20,    
    offset: int = 0,   
    date_from: Optional[datetime] = None,  
    date_to: Optional[datetime] = None,    
    sort_order: str = "desc",          
    db: AsyncSession = Depends(get_db),
    user_info: dict = Depends(RoleChecker(["admin", "superadmin"]))
):
    if limit > 100:
        limit = 100 
        
    if sort_order not in ["asc", "desc"]:
        sort_order = "desc"

    try:
        repo = TransactionsRepository(db)
        return await repo.get_user_transactions(
            limit=limit, 
            offset=offset, 
            date_from=date_from, 
            date_to=date_to, 
            sort_order=sort_order,
            user_name=user_name,
            user_id=None
        )
    except UserNotFindError:
        raise HTTPException(status_code=404, detail="Пользователь с таким именем не найден")
    except Exception:
        logger.exception("Unexpected error in get_user_transactions_by_name")
        raise HTTPException(status_code=500, detail="Internal server error")