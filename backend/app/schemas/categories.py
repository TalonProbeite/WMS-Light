from pydantic import BaseModel, ConfigDict
from typing import Optional

class CategoriesResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None