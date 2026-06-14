from pydantic import Field, BaseModel, ConfigDict , EmailStr
from typing import Optional
from datetime import datetime

class AuthResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    username: str
    role:str


class UserLogIn(BaseModel):

    username:str
    password:str