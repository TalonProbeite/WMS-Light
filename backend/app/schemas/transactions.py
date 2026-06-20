from pydantic import Field, BaseModel, ConfigDict
from typing import Optional
from datetime import datetime




class CreateTransaction(BaseModel):
    quantity:int
    transaction_type:str
    product_id:int

    model_config=ConfigDict(from_attributes=True)


class TransactionResponse(BaseModel):

    quantity:int
    transaction_type:str
    user_id:int
    product_id:int
    created_at: Optional[datetime] = None
    
    model_config=ConfigDict(from_attributes=True)