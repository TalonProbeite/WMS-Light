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


class AddUser(BaseModel):

    username:str
    password:str
    phone:Optional[str]


class UserInfo(BaseModel):
    username:str
    role:str
    phone:Optional[str]
    last_login: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)