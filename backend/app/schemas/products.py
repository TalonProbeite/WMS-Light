from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class ProductCrate(BaseModel):
    name: str
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    sku: str
    qr_code_uuid: str
    initial_quantity: Optional[int] = 0
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ProductResponse(BaseModel):
    name: str
    category_id: Optional[int] = None
    sku: str
    qr_code_uuid: str
    initial_quantity: Optional[int] = None
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ProductDetailedResponse(BaseModel):
    id: int
    name: str
    sku: str
    qr_code_uuid: str
    description: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    quantity: int
    stock_updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)